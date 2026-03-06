// FILE: api/models/Payment.js
const { name: identity } = require("./about.js");
const Waterline = require("waterline");
const moment = require("moment");

module.exports = Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    // --- Core Transaction Details ---
    id: {
      type: "string",
      required: true,
    },
    school: {
      type: "string",
      required: true,
    },
    user: {
      type: "string",
      allowNull: true,
    },
    student: {
      type: "string",
      allowNull: true,
    },
    amount: {
      type: "string",
      defaultsTo: "-",
      allowNull: true,
    },
    phone: {
      type: "string",
      required: true
    },
    description: {
      type: "string",
      allowNull: true
    },
    type: {
      type: "string",
      allowNull: true
    },
    paymentType: {
      type: "string",
      allowNull: true
    },

    // --- M-Pesa Transaction Details ---
    mpesaReceiptNumber: {
      type: "string",
      allowNull: true
    },
    transactionDate: {
      type: "string",
      allowNull: true
    },
    resultCode: {
      type: "string",
      allowNull: true
    },
    resultDesc: {
      type: "string",
      allowNull: true
    },
    merchantRequestID: {
      type: "string",
      allowNull: true
    },
    checkoutRequestID: {
      type: "string",
      allowNull: true
    },
    accountReference: {
      type: "string",
      allowNull: true
    },

    // --- Status & Metadata ---
    status: {
      type: "string",
      defaultsTo: 'PENDING',
      allowNull: true
    },
    errorMessage: {
      type: "string",
      allowNull: true
    },
    metadata: {
      type: "json",
      // columnType: "json",
      defaultsTo: {},
    },

    // --- Timestamps ---
    // --- Backward Compatibility ---
    ref: {
      type: "string",
      allowNull: true
    },
    time: {
      type: "string",
      allowNull: true
    },
    errorCode: {
      type: "string",
      allowNull: true
    },
    isDeleted: {
      type: "boolean",
      defaultsTo: false
    }
  },
  // Add these lifecycle callbacks
  beforeCreate: function(values, proceed) {
    values.createdAt = values.createdAt || moment().toISOString();
    values.updatedAt = values.updatedAt || moment().toISOString();
    return proceed();
  },

  beforeUpdate: function(values, proceed) {
    values.updatedAt = moment().toISOString();
    return proceed();
  },

  // Virtual getter for backward compatibility
  getMpesaData: function() {
    return {
      mpesaReceiptNumber: this.mpesaReceiptNumber || this.ref,
      transactionDate: this.transactionDate || this.time,
      resultCode: this.resultCode || this.errorCode,
      resultDesc: this.resultDesc || this.errorMessage,
      ...(this.metadata || {})
    };
  },

  // Method to update payment with M-Pesa response
  updateWithMpesaResponse: async function(response) {
    const updates = {
      status: this._determineStatus(response.ResultCode),
      resultCode: response.ResultCode,
      resultDesc: response.ResultDesc,
      updatedAt: new Date().toISOString(),
      // Backward compatibility
      errorCode: response.ResultCode,
      errorMessage: response.ResultDesc
    };

    // Extract data from CallbackMetadata if available
    if (response.CallbackMetadata && response.CallbackMetadata.Item) {
      response.CallbackMetadata.Item.forEach(item => {
        if (item.Name === 'Amount') updates.amount = item.Value;
        if (item.Name === 'MpesaReceiptNumber') {
          updates.mpesaReceiptNumber = item.Value;
          updates.ref = item.Value; // For backward compatibility
        }
        if (item.Name === 'TransactionDate') {
          updates.transactionDate = item.Value;
          updates.time = item.Value; // For backward compatibility
        }
        if (item.Name === 'PhoneNumber') {
          updates.phone = item.Value;
        }
      });
    }

    // Store raw response in metadata
    updates.metadata = {
      ...(this.metadata || {}),
      rawResponse: response
    };

    // Update the record
    return await this.update(updates).fetch();
  },

  // Helper method to determine status from M-Pesa result code
  _determineStatus: function(resultCode) {
    if (resultCode === '0') return 'COMPLETED';
    if (['1032', '1037'].includes(resultCode)) return 'CANCELLED';
    return 'FAILED';
  }
});