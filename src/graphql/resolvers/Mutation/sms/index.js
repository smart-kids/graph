import sms from "../../../../utils/sms";
import Handlebars from "handlebars"; // Run: npm install handlebars

// Register fallback helper to handle missing properties
Handlebars.registerHelper('fallback', function (value, fallbackValue) {
  return value !== undefined && value !== null && value !== '' ? value : fallbackValue;
});

const name = "sms";

const send = async (data, { db: { collections } }) => {
  const { message: rawTemplate, parents: parentIds } = data[name];

  // Track results of all sends
  const results = [];

  // Process each parent individually to personalize the message
  for (const id of parentIds) {
    try {
      // 1. Fetch Parent
      const parent = await collections["parent"].findOne({ where: { id } });

      if (!parent || !parent.phone) continue;

      // 2. Prepare Data Context
      const firstStudent = (parent.students && parent.students.length > 0)
        ? parent.students[0]
        : {};

      const context = {
        recipient: parent,
        parent: parent,
        student: firstStudent
      };

      // 3. Compile Message
      const template = Handlebars.compile(rawTemplate);
      const compiledMessage = template(context);

      // 4. Create and collect promise for this SMS
      const smsPromise = new Promise((resolve, reject) => {
        sms({ data: { phone: parent.phone, message: compiledMessage } }, (error, response) => {
          if (error) {
            console.error(`[SMS Service] Failed to send to ${parent.name} (${parent.phone}):`, error.message);
            // Ensure we preserve the error message in the error object
            const errorObj = new Error(error.message || 'Failed to send SMS');
            errorObj.response = error.response || {};
            errorObj.parentId = id;
            errorObj.phone = parent.phone;
            reject({ success: false, parentId: id, phone: parent.phone, error: errorObj });
          } else if (response?.status === false) {
            const errorMsg = `[SMS Service] Failed to send to ${parent.name} (${parent.phone}): ${response.message} (${response.responseCode})`;
            console.error(errorMsg);
            const errorObj = new Error(errorMsg);
            errorObj.response = { data: { message: response.message } };
            errorObj.parentId = id;
            errorObj.phone = parent.phone;
            reject({ success: false, parentId: id, phone: parent.phone, error: errorObj });
          } else {
            console.log(`[SMS Service] Successfully sent to ${parent.name} (${parent.phone}):`, response?.messageId || 'No message ID');
            resolve({ success: true, parentId: id, phone: parent.phone, response });
          }
        });
      });

      results.push(smsPromise);
    } catch (err) {
      console.error(`[SMS Service] Error processing parent ID ${id}:`, err.message);
      const errorObj = new Error(err.message || 'Failed to process SMS');
      errorObj.parentId = id;
      results.push(Promise.resolve({ success: false, parentId: id, error: errorObj }));
    }
  }

  // Wait for all sends to complete
  const sendResults = await Promise.allSettled(results);

  // Process results
  const successfulSends = [];
  const failedSends = [];

  sendResults.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value?.success) {
      successfulSends.push({
        parentId: result.value.parentId,
        phone: result.value.phone
      });
    } else {
      const { error } = result.reason
      // Ensure we get the most specific error message available
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      failedSends.push({
        parentId: error?.parentId || parentIds[index],
        phone: error?.phone || 'Unknown',
        error: errorMessage
      });
    }
  });

  // Log summary
  console.log(`[SMS Service] Summary: ${successfulSends.length} sent successfully, ${failedSends.length} failed`);

  // Log detailed errors if any
  if (failedSends.length > 0) {
    console.error('[SMS Service] Failed sends:', failedSends);
  }

  // Return a response that matches the GraphQL schema
  return {
    success: failedSends.length === 0,
    message: failedSends.length === 0
      ? `Successfully sent ${successfulSends.length} messages`
      : `Sent ${successfulSends.length} messages, failed to send ${failedSends.length} messages`,
    sentCount: successfulSends.length,
    failedCount: failedSends.length,
    successfulSends: successfulSends.map(send => ({
      parentId: send.parentId,
      phone: send.phone
    })),
    failedSends: failedSends.map(send => ({
      parentId: send.parentId,
      phone: send.phone,
      error: send.error
    }))
  };
};

export default () => ({
  send,
});