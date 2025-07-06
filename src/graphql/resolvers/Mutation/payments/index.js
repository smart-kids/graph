// FILE: api/controllers/payment/actions.js

import { ObjectId } from "mongodb";
import { UserError } from "graphql-errors";

// Assuming mpesaService is a globally available service in your Sails app
import { createMpesaService } from './mpesa.js'; 

const { name } = require("./about.js"); // Assuming 'name' resolves to 'payment'

/**
 * Initiates an M-Pesa STK Push payment request.
 */
const init = async (
  data,
  // The context now provides everything we need to inject
  { auth, db: { collections } }
) => {
  console.log({data, auth})
  const transactionId = new ObjectId().toHexString();
  const { schoolId="general", id: userId } = auth;
  const { ammount:amount, phone,}= data[name]

  // 1. Create an instance of the M-Pesa service by injecting dependencies.
  const mpesaService = createMpesaService({
    collections: collections,                // Pass the database collections
    logger: console,                       // Pass the sails logger
  });

  // 2. Call the method on the service instance.
  //    The service itself will now handle creating and updating the database records.
  const result = await mpesaService.initiateSTKPush({
    amount,
    phone,
    schoolId,
    userId,
    transactionId,
  });
  
  // 3. Return the result from the service directly to the user.
  //    If the result indicates failure, throw a UserError.
  if (!result.success) {
    // You can choose to throw a generic error to the user for security.
    throw new UserError(result.message || 'An unexpected error occurred during payment initiation.');
  }

  return result;
};

/**
 * Creates a new payment record directly.
 * Useful for manual entries by an administrator.
 */
const create = async (data, { db: { collections } }) => {
  const id = new ObjectId().toHexString();
  const entry = Object.assign(data[name], { id, isDeleted: false, time: new Date() });

  try {
    await collections[name].create(entry);
    return entry;
  } catch (err) {
    console.log(err);
    throw new UserError(err.details);
  }
};

const archive = async (data, { db: { collections } }) => {
  const { id } = data[name];
  try {
    await collections[name].update({ id }).set({ isDeleted: true });
    return { id };
  } catch (err) {
    throw new UserError(err.details);
  }
};

const restore = async (data, { db: { collections } }) => {
  const { id } = data[name];
  try {
    await collections[name].update({ id }).set({ isDeleted: false });
    return { id };
  } catch (err) {
    throw new UserError(err.details);
  }
};

const confirm = async (data, { db: { collections } }) => {
  const { id } = data[name];
  try {
    const existingPayment = await collections[name].findOne({ id });
    if (!existingPayment) {
      throw new UserError(`Payment ${id} not found.`);
    }
    if (existingPayment.status !== 'PENDING') {
      throw new UserError(`Payment ${id} is already in status '${existingPayment.status}'.`);
    }
    const { ResultCode, ResultDesc, CallbackMetadata } = data[name];
    if (ResultCode === 0) {
      const metadata = parseMetadata(CallbackMetadata?.Item);
      const receivedAmount = Number(metadata.amount);
      if (receivedAmount !== existingPayment.amount) {
        throw new UserError(`Amount mismatch for ${id}. Expected: ${existingPayment.amount}, Received: ${receivedAmount}.`);
      }
      await collections[name].updateOne({ id }).set({
        status: 'COMPLETED',
        ref: metadata.mpesaReceiptNumber,
        time: moment(String(metadata.transactionDate), 'YYYYMMDDHHmmss').toDate(),
        errorMessage: null,
      });
    } else {
      await collections[name].updateOne({ id }).set({
        status: 'FAILED_ON_CALLBACK',
        errorCode: String(ResultCode),
        errorMessage: ResultDesc,
      });
    }
    return { id };
  } catch (err) {
    throw new UserError(err.details);
  }
};

export default () => {
  return {
    create,
    archive,
    restore,
    init,
    confirm,
    // The `confirm` function is removed. The M-Pesa callback is the primary
    // method of confirmation. If a polling mechanism is needed, a separate
    // `getPaymentStatus(transactionId)` resolver should be created.
  };
};