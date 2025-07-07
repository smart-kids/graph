// FILE: src/api/routes/payments.js (or wherever createMpesaRouter is located)

import express from 'express';
import bodyParser from 'body-parser';
import moment from 'moment';
import sms from '../graphql/resolvers/Mutation/sms';
import { name } from "../graphql/resolvers/Mutation/payments/about.js";

/**
 * A helper function to parse the M-Pesa metadata array into a more usable object.
 */
const parseMetadata = (items = []) => {
  if (!Array.isArray(items)) {
    return {}; // Return empty object if metadata is missing or not an array
  }
  return items.reduce((acc, item) => {
    // Convert first character to lower case, e.g., 'MpesaReceiptNumber' -> 'mpesaReceiptNumber'
    const key = item.Name.charAt(0).toLowerCase() + item.Name.slice(1);
    acc[key] = item.Value;
    return acc;
  }, {});
};

/**
 * Factory function to create the M-Pesa callback router.
 * It's completely self-contained and relies only on injected dependencies.
 *
 * @param {object} db - The database storage object, expected to have a `collections.payment` property.
 * @param {object} io - The Socket.IO server instance for real-time events.
 * @returns {express.Router} An Express router instance.
 */

  /**
   * This is the M-Pesa STK Push Callback endpoint.
   * It handles validation and processing of the transaction result.
   */
  export const createMpesaRouter = async (db, io) => {
    const router = express.Router();
    router.use(bodyParser.json());
    const dbInstance= await db;
    const PaymentCollection = dbInstance.collections[name];
  
    router.post('/lipaCallback/:txid', async (req, res) => {
      const logger = console;
      const { txid } = req.params;
  
      logger.log(`[Callback] Received M-Pesa STK Callback for txid: ${txid}`);
      console.log("[Callback] Body: ", JSON.stringify(req.body));
  
      res.json({ ResponseCode: '0', ResponseDesc: 'Success' });
  
      try {
        if (!req.body.Body || !req.body.Body.stkCallback) {
          logger.error(`[Callback] Invalid callback format for txid: ${txid}.`);
          return;
        }
        const { stkCallback } = req.body.Body;
  
        // FIX 1: Use .findOne() to get a single object, not an array.
        const existingPayment = await PaymentCollection.findOne({ id: txid });
  
        if (!existingPayment) {
          logger.error(`[Security] FATAL: Callback for non-existent payment ID: ${txid}. Ignoring.`);
          return;
        }
  
        if (existingPayment.status !== 'PENDING') {
          logger.warn(`[Security] Idempotency check failed. Payment ${txid} is already '${existingPayment.status}'. Ignoring.`);
          return;
        }
  
        if (stkCallback.ResultCode === 0) {
          const metadata = parseMetadata(stkCallback.CallbackMetadata?.Item);
          const receivedAmount = Number(metadata.amount);
  
          if (receivedAmount !== existingPayment.amount) {
            logger.error(`[Security] Amount mismatch for ${txid}. Expected: ${existingPayment.amount}, Received: ${receivedAmount}.`);
            const updatePayload = {
              status: 'FLAGGED_AMOUNT_MISMATCH',
              errorMessage: `Amount mismatch: Expected ${existingPayment.amount}, but received ${receivedAmount}.`,
              ref: metadata.mpesaReceiptNumber,
              time: moment(String(metadata.transactionDate), 'YYYYMMDDHHmmss').toDate(),
            };
            // FIX 2: Use the modern .updateOne().set() syntax for clarity.
            await PaymentCollection.updateOne({ id: txid }).set(updatePayload);
            
            // Your SMS logic here is fine.
            // sms.sendSms(...) 
            return;
          }
  
          const updatePayload = {
            status: 'COMPLETED',
            ref: metadata.mpesaReceiptNumber,
            time: moment(String(metadata.transactionDate), 'YYYYMMDDHHmmss').toDate(),
            errorMessage: null,
          };
          
          // FIX 2: Use the modern .updateOne().set() syntax.
          await PaymentCollection.updateOne({ id: txid }).set(updatePayload);
          logger.log(`[Callback] Successfully updated payment ${txid} to COMPLETED.`);
  
          if (io && existingPayment.userId) {
            io.to(`user_${existingPayment.userId}`).emit('payment_success', {
              message: 'Your payment was successful!',
              transactionId: txid,
              amount: receivedAmount,
            });
          }
  
        } else {
          const updatePayload = {
            status: 'FAILED_ON_CALLBACK',
            errorCode: String(stkCallback.ResultCode),
            errorMessage: stkCallback.ResultDesc,
          };
          // FIX 2: Use the modern .updateOne().set() syntax.
          await PaymentCollection.updateOne({ id: txid }).set(updatePayload);
          logger.log(`[Callback] Updated failed payment ${txid}: ${stkCallback.ResultDesc}`);
          
          if (io && existingPayment.userId) {
            io.to(`user_${existingPayment.userId}`).emit('payment_failure', {
              message: stkCallback.ResultDesc || 'Your payment failed.',
              transactionId: txid,
            });
          }
        }
      } catch (error) {
        logger.error(`[Callback] FATAL error while processing callback for txid ${txid}:`, error.message, error.stack);
      }
    });
  
    return router;
};