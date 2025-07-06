// FILE: api/models/Payment.js
const { name: identity } = require("./about.js")
var Waterline = require("waterline");
/**
 * The Payment model acts as a simple data store and state machine for all M-Pesa transactions.
 * It is the single source of truth for a payment's status.
 *
//  * All business logic, validation, and side effects have been moved to the
 * GraphQL resolvers (for initiation) and the Express callback router (for processing).
 * This keeps the model lean and focused solely on data structure.
 */
module.exports = Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",



  attributes: {
    // --- Core Transaction Details ---
    id: {
      type: "string",
      required: true,
      // Our internal transaction ID, used to securely identify the transaction in the callback URL.
    },
    school: {
      type: "string",
      required: true,
      // Our internal transaction ID, used to securely identify the transaction in the callback URL.
    },
    user: {
      type: "string",
      // Indexed for fast lookups of a user's payment history.
    },
    amount: {
      type: "number",
      // required: true,
      defaultsTo: 0,
      allowNull: true,
      // description: 'The amount we requested the user to pay.',
    },
    phone: {
      type: "string",
      required: true
    },

    // --- State Machine ---
    status: {
      type: "string",
      // required: true,
      // isIn: ['PENDING', 'COMPLETED', 'FAILED_ON_CALLBACK', 'FAILED_ON_INITIATION', 'FLAGGED_AMOUNT_MISMATCH'],
      defaultsTo: 'PENDING',
      // description: 'Tracks the lifecycle of the transaction.',
      // Indexed to easily find pending or flagged transactions.
    },

    // --- M-Pesa Request Details (from our initiation) ---
    merchantRequestID: {
      type: "string",
      allowNull: true,
      // description: 'From Safaricom, used for reconciliation.',
    },
    checkoutRequestID: {
      type: "string",
      allowNull: true,
      // description: 'From Safaricom, used for reconciliation.',
    },

    // --- M-Pesa Callback Details (from their server) ---
    ref: {
      type: "string",
      // description: 'The final MpesaReceiptNumber from a successful transaction.',
      // Indexed for customer support lookups.
    },
    time: {
      type: "string", 
      // columnType: "timestamptz",
      // description: 'The official transaction timestamp from M-Pesa.',
    },

    // --- Error & Debugging Details ---
    errorCode: { type: 'string' },
    errorMessage: { type: "string", allowNull: true },

    // Standard attributes
    isDeleted: { type: "boolean", defaultsTo: false },
  },

  // NO lifecycle callbacks.
  // NO customToJSON. The GraphQL layer will handle field exposure.
});