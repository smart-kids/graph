var Waterline = require("waterline");

export default Waterline.Collection.extend({
  identity: "expense",
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    name: { type: "string", required: true },
    minimumAmount:{ type: "number", required: true },
    security: { type: "string", required: true },
    rate: { type: "number", required: true },
  
    controls: { type: "boolean", required: true },
    vat: { type: "boolean", required: true },
    exercise: { type: "boolean", required: true },
  
    remark: { type: "string", required: true },

    isDeleted: { type: "boolean", required: true }
  }
});
