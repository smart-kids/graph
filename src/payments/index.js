// FILE: src/api/routes/payments.js (or wherever createMpesaRouter is located)

import express from 'express';
import bodyParser from 'body-parser';
import moment from 'moment';
import sms from '../graphql/resolvers/Mutation/sms';

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
export const createMpesaRouter = (collections, io) => {
  const router = express.Router();
  router.use(bodyParser.json());

  // Get the Waterline collection for payments from the injected db object
  const PaymentCollection = collections.payment;

  /**
   * This is the M-Pesa STK Push Callback endpoint.
   * It handles validation and processing of the transaction result.
   */
  router.post('/lipaCallback/:txid', async (req, res) => {
    const { txid } = req.params;
    const logger = console; // Use a simple logger, or inject one if needed

    logger.log(`[Callback] Received M-Pesa STK Callback for txid: ${txid}`);
    logger.log(`[Callback] Body:`, JSON.stringify(req.body));

    // 1. Acknowledge the request from M-Pesa immediately to prevent timeouts on their end.
    res.json({ ResponseCode: '0', ResponseDesc: 'Success' });

    try {
      // Ensure the callback body has the expected structure
      if (!req.body.Body || !req.body.Body.stkCallback) {
        logger.error(`[Callback] Invalid callback format for txid: ${txid}. Missing 'Body.stkCallback'.`);
        return;
      }
      const { stkCallback } = req.body.Body;

      // 2. Fetch the original payment record from the database using the injected collection.
      const existingPayment = await PaymentCollection.findOne({ id: txid });
      if (!existingPayment) {
        logger.error(`[Security] FATAL: Callback received for non-existent payment ID: ${txid}. Ignoring.`);
        return;
      }

      // 3. IDEMPOTENCY CHECK: Ensure we haven't already processed this payment.
      if (existingPayment.status !== 'PENDING') {
        logger.warn(`[Security] Idempotency check failed. Payment ${txid} is already in status '${existingPayment.status}'. Ignoring duplicate callback.`);
        return;
      }

      // 4. Process the callback based on the result code.
      if (stkCallback.ResultCode === 0) {
        // --- SUCCESSFUL TRANSACTION ---
        const metadata = parseMetadata(stkCallback.CallbackMetadata?.Item);
        const receivedAmount = Number(metadata.amount);

        // 5. AMOUNT VALIDATION: Ensure the user paid the exact amount we requested.
        if (receivedAmount !== existingPayment.amount) {
          logger.error(`[Security] Amount mismatch for ${txid}. Expected: ${existingPayment.amount}, Received: ${receivedAmount}.`);
          const updatePayload = {
            status: 'FLAGGED_AMOUNT_MISMATCH',
            errorMessage: `Amount mismatch: Expected ${existingPayment.amount}, but received ${receivedAmount}.`,
            ref: metadata.mpesaReceiptNumber,
            time: moment(String(metadata.transactionDate), 'YYYYMMDDHHmmss').toDate(),
          };
          await PaymentCollection.updateOne({ id: txid }).set(updatePayload);
          // TODO: Trigger an alert for admin review (e.g., via email or a specific socket event).

          sms.sendSms({
            to: "254743214479",
            message: `This payment of ${existingPayment.amount} has been flagged for review.`,
          });
          return;
        }

        // --- All checks passed, payment is valid ---
        const updatePayload = {
          status: 'COMPLETED',
          ref: metadata.mpesaReceiptNumber,
          time: moment(String(metadata.transactionDate), 'YYYYMMDDHHmmss').toDate(),
          errorMessage: null,
        };
        
        await PaymentCollection.updateOne({ id: txid }).set(updatePayload);
        logger.log(`[Callback] Successfully updated payment ${txid} to COMPLETED.`);

        // --- Post-payment Success Events ---
        // Emit a socket event to the specific user or school to update their UI in real-time.
        if (io && existingPayment.userId) {
          io.to(`user_${existingPayment.userId}`).emit('payment_success', {
            message: 'Your payment was successful!',
            transactionId: txid,
            amount: receivedAmount,
          });
        }
        // TODO: You could also trigger other events like sending a receipt email here.

      } else {
        // --- FAILED OR CANCELLED TRANSACTION ---
        const updatePayload = {
          status: 'FAILED_ON_CALLBACK',
          errorCode: String(stkCallback.ResultCode),
          errorMessage: stkCallback.ResultDesc,
        };
        await PaymentCollection.updateOne({ id: txid }).set(updatePayload);
        logger.log(`[Callback] Updated failed payment ${txid}: ${stkCallback.ResultDesc}`);
        
        // --- Post-payment Failure Events ---
        if (io && existingPayment.userId) {
          io.to(`user_${existingPayment.userId}`).emit('payment_failure', {
            message: stkCallback.ResultDesc || 'Your payment failed.',
            transactionId: txid,
          });
        }
      }
    } catch (error) {
      logger.error(`[Callback] FATAL error while processing callback for txid ${txid}:`, error.message, error.stack);
      // At this point, the transaction remains PENDING and might require manual intervention.
    }
  });

  return router;
};