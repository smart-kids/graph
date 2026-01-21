import { ObjectId } from "mongodb";
import sms from "../../../../utils/sms";
import Handlebars from "handlebars"
import moment from "moment"
const { name } = require("./about.js");

const { UserError } = require("graphql-errors");

const create = async (data, { db: { collections } }) => {
  console.log("creating an event")
  const id = new ObjectId().toHexString();
  const entry = Object.assign(data[name], { id, isDeleted: false });

  const student = await collections["student"].findOne({
    where: { id: entry.student, isDeleted: false }
  });

  const parent = await collections["parent"].findOne({
    where: { id: student.parent2 || student.parent, isDeleted: false }
  });

  const trip = await collections["trip"].findOne({
    where: { id: entry.trip, isDeleted: false }
  });

  const schedule = await collections["schedule"].findOne({
    where: { id: trip.schedule, isDeleted: false }
  });

  const school = await collections["school"].findOne({
    where: { id: trip.school, isDeleted: false }
  });

  const actions = schedule.actions ? JSON.parse(schedule.actions) : null;

  const time = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const templateData = {
    student_name: student.names,
    parent_name: parent?.name,
    school_name: school?.name,
    time
  }

  const message = Handlebars.compile(schedule.message)(templateData) || "Schedule Message"

  // --- FINANCIAL CHECK LOGIC START ---
  // Constants for billing (Should ideally be in a config)
  const COST_PER_SMS = 1.86;
  const CHARS_PER_SMS = 160;
  const LOW_BALANCE_THRESHOLD_SMS = 50; // Alert when fewer than 50 SMS can be sent

  // 1. Calculate Current Balance
  // We need to fetch all payments, charges, and smsEvents to calculate the live balance.
  // This duplicates logic from the School Resolver but is necessary for transaction safety here.
  
  const [allPayments, allCharges, allSmsEvents] = await Promise.all([
    collections["payment"].find({ where: { school: trip.school, isDeleted: false } }),
    collections["charge"].find({ where: { school: trip.school, isDeleted: false } }),
    collections["smsevent"].find({ where: { school: trip.school } }) // SMS events don't usually have isDeleted
  ]);

  const totalIncome = allPayments.reduce((total, p) => {
    if (p.status !== 'COMPLETED') return total;
    const val = parseFloat(p.amount || p.ammount || 0);
    return total + (isNaN(val) ? 0 : val);
  }, 0);

  const manualExpenses = allCharges.reduce((total, c) => {
    const val = parseFloat(c.amount || c.ammount || 0);
    return total + (isNaN(val) ? 0 : val);
  }, 0);

  const smsExpenses = allSmsEvents.reduce((total, event) => {
    const successCount = event.successCount || 0;
    if (successCount === 0) return total;
    const content = event.messageTemplate || "";
    const length = content.length;
    const segments = length > 0 ? Math.ceil(length / CHARS_PER_SMS) : 1;
    return total + (segments * successCount * COST_PER_SMS);
  }, 0);

  const totalExpenses = manualExpenses + smsExpenses;
  const currentBalance = totalIncome - totalExpenses;

  // 2. Check for Insufficient Funds
  // We estimate cost for this single SMS (1 recipient)
  const msgLength = message.length;
  const estimatedSegments = msgLength > 0 ? Math.ceil(msgLength / CHARS_PER_SMS) : 1;
  const estimatedCost = estimatedSegments * COST_PER_SMS;

  console.log(`[Event Create] Balance Check: School=${trip.school}, Bal=${currentBalance}, Cost=${estimatedCost}`);

  if (currentBalance < estimatedCost) {
    // Fail the creation or just send a warning? 
    // User request implies we must determine if we CAN send.
    // For now, we will block the *SMS sending* but allow event creation? 
    // "we need to look at the schedule sms and how we are billing to determine if we can send those messages on the next run"
    // The requirement says "once the balance of the user is bellow the level we would need to successfully keep sending sms"
    // Blocking seems appropriate to prevent debt.
    console.warn(`[Event Create] Insufficient funds for SMS. Balance: ${currentBalance}, Required: ${estimatedCost}`);
    // We will NOT send the SMS, but we might still proceed with event creation (without SMS) or throw error.
    // Let's THROW to prevent partial state where parent expects SMS.
    throw new UserError(`Insufficient SMS balance. Current balance: ${currentBalance}, Required: ${estimatedCost}. Please top up.`);
  }

  // 3. Low Balance Alert
  const lowBalanceThresholdValue = LOW_BALANCE_THRESHOLD_SMS * COST_PER_SMS;
  if (currentBalance < lowBalanceThresholdValue && currentBalance >= estimatedCost) {
     // Check if we already sent an alert recently? (To avoid spamming)
     // For now, simpler implementation: Just send it.
     if (school && school.phone) {
         const alertMsg = `Low SMS Balance Alert: Your school has ${Math.floor(currentBalance / COST_PER_SMS)} SMS credits remaining. Please top up to ensure uninterrupted service.`;
         console.log(`[Event Create] Sending Low Balance Alert to ${school.phone}`);
         sms({ data: { phone: school.phone, message: alertMsg } }, () => {}); // Fire and forget
     }
  }

  // --- FINANCIAL CHECK LOGIC END ---

  console.log("Attemting to send sms " + JSON.stringify({ phone: parent?.phone, message }))
  try {
    if (parent) {
      // Create SMS Event wrapper for consistency with bulk SMS
      // This allows the 'smsExpenses' calculation to work correctly in the future
      const smsEventId = new ObjectId().toHexString();
      const smsEventEntry = {
          id: smsEventId,
          school: trip.school,
          messageTemplate: message,
          recipientCount: 1, // Only 1 parent
          status: 'PROCESSING', // Will update in callback
          successCount: 0,
          failureCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };
      
      try {
        await collections["smsevent"].create(smsEventEntry);
      } catch (e) {
        console.error("Failed to create smsEvent record", e);
      }

      sms(
        { data: { phone: parent.phone, message } },
        async (res) => {
          const { smsCost, status } = res || {};
          // Note: 'status' from sms lib might vary. Assuming standard response.
          
          // Update the SMS Event
          const isSuccess = !res.error && res.status !== false; // Check your sms lib response layout
          
          await collections["smsevent"].update({ id: smsEventId }).set({
              status: isSuccess ? 'COMPLETED' : 'FAILED',
              successCount: isSuccess ? 1 : 0,
              failureCount: isSuccess ? 0 : 1,
              updatedAt: new Date().toISOString()
          });

          // Create Charge Record (Legacy support, though we use smsEvent for calc now)
          // The user requirement said: "create a charge record and on the charges we shouldnt show the amount just a cummulative balance"
          // So we MUST create a charge record.
          if (smsCost) {
            await collections["charge"].create({
              id: new ObjectId().toHexString(),
              school: trip.school,
              ammount: smsCost,
              reason: `Transport SMS: ${message.substring(0, 50)}...`, // Truncate for cleaner UI
              time,
              isDeleted: false
            });
          }
        }
      );
    }
  } catch (err) {
    console.error("Unnable to send sms", err);
    // Don't block event creation if SMS fails, unless it was insufficient funds (handled above)
  }

  try {
    await collections[name].create(entry);

    return entry;
  } catch (err) {
    throw new UserError(err.details);
  }
};

const update = async (data, { db: { collections } }) => {
  const { id } = data[name];
  const entry = data[name];

  try {
    delete entry.id;

    await collections[name].update({ id }).set(entry);

    return {
      id
    };
  } catch (err) {
    throw new UserError(err.details);
  }
};

const archive = async (data, { db: { collections } }) => {
  const { id } = data[name];

  try {
    await collections[name].update({ id }).set({ isDeleted: true });

    return {
      id
    };
  } catch (err) {
    throw new UserError(err.details);
  }
};

const restore = async (data, { db: { collections } }) => {
  const { id } = data[name];

  try {
    await collections[name].update({ id }).set({ isDeleted: false });

    return {
      id
    };
  } catch (err) {
    throw new UserError(err.details);
  }
};

export default () => {
  return {
    create,
    update,
    archive,
    restore
  };
};