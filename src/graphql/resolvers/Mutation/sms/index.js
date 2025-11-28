import sms from "../../../../utils/sms";
import Handlebars from "handlebars";
import { v4 as uuidv4 } from 'uuid';

Handlebars.registerHelper('fallback', function (value, fallbackValue) {
  return value !== undefined && value !== null && value !== '' ? value : fallbackValue;
});

const name = "sms";
const BATCH_SIZE = 50;

// Helper to chunk array
const chunkArray = (array, size) => {
  const chunked = [];
  let index = 0;
  while (index < array.length) {
    chunked.push(array.slice(index, index + size));
    index += size;
  }
  return chunked;
};

const sanitizeError = (err) => {
  if (!err) return null;
  return {
    message: err.message,
    code: err.code || err.response?.status,
    responseBody: err.response?.data || null,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  };
};

const send = async (data, { db: { collections } }) => {
  const { message: rawTemplate, parents: parentIds, school: inputSchoolId } = data[name];
  
  let schoolId = inputSchoolId;
  if (!schoolId && parentIds.length > 0) {
    const p = await collections["parent"].findOne({ where: { id: parentIds[0] }, select: ['school'] });
    if (p) schoolId = p.school;
  }

  const eventId = uuidv4();
  let smsEvent;
  
  if (schoolId) {
    try {
      smsEvent = await collections["smsevent"].create({
        id: eventId,
        school: schoolId,
        messageTemplate: rawTemplate,
        recipientCount: parentIds.length,
        status: 'PROCESSING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).fetch();
    } catch (e) {
      console.error("Failed to create SMS Event record:", e);
    }
  }

  const successfulSends = [];
  const failedSends = [];
  const batches = chunkArray(parentIds, BATCH_SIZE);

  console.log(`[SMS Service] Starting processing of ${parentIds.length} recipients in ${batches.length} batches.`);

  for (const [batchIndex, batchIds] of batches.entries()) {
    try {
      const parents = await collections["parent"].find({ where: { id: { in: batchIds } } });
      const parentMap = new Map(parents.map(p => [p.id, p]));
      const batchPromises = [];

      for (const id of batchIds) {
        const parent = parentMap.get(id);

        if (!parent || !parent.phone) {
          batchPromises.push(Promise.reject({
            parentId: id,
            phone: "Unknown",
            name: "Unknown Parent",
            error: "Parent not found or no phone number",
            raw: { reason: "Database lookup failed" }
          }));
          continue;
        }

        const firstStudent = (parent.students && parent.students.length > 0) ? parent.students[0] : {};
        const context = { recipient: parent, parent: parent, student: firstStudent };
        let compiledMessage = "";
        try {
            const template = Handlebars.compile(rawTemplate);
            compiledMessage = template(context);
        } catch (tplErr) {
            compiledMessage = rawTemplate;
        }

        const p = new Promise((resolve, reject) => {
          // Log specific parent phone for debug
          console.log(`[SMS Service] Sending message to ${parent.phone}`);
          
          sms({ data: { phone: parent.phone, message: compiledMessage } }, (error, response) => {
            if (error) {
              reject({
                parentId: id,
                phone: parent.phone,
                name: parent.name,
                compiledMessage,
                error: error.message || 'Gateway Connection Error',
                raw: sanitizeError(error)
              });
            } else if (response?.status === false) {
              reject({
                parentId: id,
                phone: parent.phone,
                name: parent.name,
                compiledMessage,
                error: response.message || `API Error: ${response.responseCode}`,
                raw: response
              });
            } else {
              console.log(`[SMS Service] Success:`, response);
              resolve({
                parentId: id,
                phone: parent.phone,
                name: parent.name,
                compiledMessage,
                raw: response
              });
            }
          });
        });
        batchPromises.push(p);
      }

      const batchResults = await Promise.allSettled(batchPromises);
      const logsToCreate = [];

      batchResults.forEach((result) => {
        const logId = uuidv4();
        const commonLogData = {
            id: logId,
            event: eventId,
            school: schoolId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (result.status === 'fulfilled') {
          const val = result.value;
          successfulSends.push({ parentId: val.parentId, phone: val.phone });
          
          if (smsEvent) {
            logsToCreate.push({
              ...commonLogData,
              recipientName: val.name,
              recipientPhone: val.phone,
              compiledMessage: val.compiledMessage,
              status: 'DELIVERED',
              // --- FIX IS HERE: Use empty string instead of null ---
              error: "", 
              providerResponse: val.raw
            });
          }
        } else {
          const errData = result.reason;
          failedSends.push({ parentId: errData.parentId, phone: errData.phone, error: errData.error });
          
          if (smsEvent) {
            logsToCreate.push({
              ...commonLogData,
              recipientName: errData.name || "Unknown",
              recipientPhone: errData.phone || "Unknown",
              compiledMessage: errData.compiledMessage || "",
              status: 'FAILED',
              // Ensure we don't pass null here either just in case
              error: errData.error || "Unknown Error", 
              providerResponse: errData.raw
            });
          }
        }
      });

      if (logsToCreate.length > 0) {
        await collections["smslog"].createEach(logsToCreate);
      }

      console.log(`[SMS Service] Batch ${batchIndex + 1}/${batches.length} processed.`);

    } catch (batchError) {
      console.error(`[SMS Service] Critical error in batch ${batchIndex}:`, batchError);
    }
  }

  if (smsEvent) {
    try {
      let overallStatus = 'COMPLETED';
      if (failedSends.length > 0) {
        overallStatus = successfulSends.length > 0 ? 'PARTIAL' : 'FAILED';
      }

      await collections["smsevent"].updateOne({ id: eventId }).set({
        status: overallStatus,
        successCount: successfulSends.length,
        failureCount: failedSends.length,
        recipientCount: successfulSends.length + failedSends.length,
        updatedAt: new Date().toISOString()
      });
      
      console.log(`[SMS Service] Event ${eventId} updated. Status: ${overallStatus}`);
    } catch (updateError) {
      console.error("[SMS Service] Failed to update event status:", updateError);
    }
  }

  return {
    success: failedSends.length === 0,
    message: failedSends.length === 0
      ? `Successfully sent ${successfulSends.length} messages`
      : `Sent ${successfulSends.length} messages, failed to send ${failedSends.length} messages`,
    sentCount: successfulSends.length,
    failedCount: failedSends.length,
    successfulSends,
    failedSends
  };
};

export default () => ({
  send,
});