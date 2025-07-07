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
  const PaymentCollection = collections[name];
  const { MerchantRequestID, CheckoutRequestID, school } = data;

  // 1. Find the payment record in your database.
  const payment = await PaymentCollection.find({ MerchantRequestID, CheckoutRequestID, school }).limit(1);

  // 2. If no payment is found, inform the user.
  if (!payment) {
    return {
      success: false,
      message: `Payment not found.`,
    };
  }

  // 3. Return the relevant, client-safe data.
  // The frontend will look at the 'status' field to decide what to display.
  return {
    success: payment.status === 'COMPLETED',
    message: payment.errorMessage || `Payment is in progress. status:${payment.status}`,
  };
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