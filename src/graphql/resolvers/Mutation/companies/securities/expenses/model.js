var Waterline = require("waterline");

export default Waterline.Collection.extend({
  identity: "security",
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    name: { type: "string", required: true },
    minimumAmount: { type: "string", required: true },
    remark: { type: "string", required: true },
    fund: { type: "string", required: true },
    amount: { type: "string", required: true },
    percentage: { type: "number", required: true },

    remark: { type: "string", required: true },
    controls: { type: "boolean", required: true },

    vat: { type: "boolean", required: true },
    charge: { type: "boolean", required: true },
    
    isDeleted: { type: "boolean", required: true }
  }
});
