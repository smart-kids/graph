// FILE: api/controllers/payment/actions.js

import { ObjectId } from "mongodb";
import { UserError } from "graphql-errors";

// Assuming mpesaService is a globally available service in your Sails app
import { createMpesaService } from './mpesa.js'; 

const { name } = require("./about.js"); // Assuming 'name' resolves to 'payment'

/**
 * Initiates an M-Pesa STK Push payment request.
 */
const init = async (data, { auth, db: { collections } }) => {
  const transactionId = new ObjectId().toHexString();
  const { schoolId = "general", id: userId } = auth;
  const { ammount: amount, phone } = data.payment; // Changed from data[name] to data.payment

  const mpesaService = createMpesaService({
    collections: collections,
    logger: console,
  });

  // Pass all required parameters including schoolId
  const result = await mpesaService.initiateSTKPush({
    amount,
    phone,
    schoolId, // Make sure this is passed
    userId,
    transactionId,
  });

  if (!result.success) {
    throw new UserError(result.message || 'Payment initiation failed');
  }

  return {
    ...result,
    id: transactionId, // Ensure consistent ID usage
  };
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

// In api/controllers/payment/actions.js
const confirm = async (data, { db: { collections } }) => {
  const PaymentCollection = collections.payment;
  const { payment } = data;
  
  // Try to find by transaction ID first
  const paymentRecord = await PaymentCollection.findOne({ 
    id: payment.CheckoutRequestID || payment.MerchantRequestID 
  });

  if (!paymentRecord) {
    // If not found by ID, try by request IDs
    const [recordByRequest] = await PaymentCollection.find({
      merchantRequestID: payment.MerchantRequestID,
      checkoutRequestID: payment.CheckoutRequestID,
    }).limit(1);

    if (!recordByRequest) {
      return {
        success: false,
        message: "Payment record not found",
      };
    }
    return formatPaymentResponse(recordByRequest);
  }

  return formatPaymentResponse(paymentRecord);
};

function formatPaymentResponse(record) {
  return {
    success: record.status === 'COMPLETED',
    message: record.errorMessage || record.status,
    id: record.id,
    amount: record.amount,
    phone: record.phone,
    status: record.status,
    merchantRequestID: record.merchantRequestID,
    checkoutRequestID: record.checkoutRequestID,
    ref: record.ref,
    time: record.time,
  };
}

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