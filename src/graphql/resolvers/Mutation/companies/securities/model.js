var Waterline = require("waterline");

export default Waterline.Collection.extend({
  identity: "security",
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    company: { type: "string", required: true },
    code: { type: "string", required: true },
    name: { type: "string", required: true },
    type: { type: "string", required: true },
    abbreviation: { type: "string", required: true },
    frequency: { type: "number", required: true },

    adminFee: { type: "string", required: true },
    managementFee: { type: "number", required: true },

    currency: { type: "string", required: true },
    currencyCode: { type: "string", required: true },

    accountNumber: { type: "number", required: true },
    disbursementAccount: { type: "number", required: true },

    Description: { type: "string", required: true },
    isDeleted: { type: "boolean", required: true }
  }
});
