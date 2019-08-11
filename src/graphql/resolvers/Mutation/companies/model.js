var Waterline = require("waterline");

export default Waterline.Collection.extend({
  identity: "company",
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    name: { type: "string", required: true },
    address: { type: "string" },
    email: { type: "string", required: true },
    town: { type: "string" },
    mobile: { type: "number" },
    physicalAddress: { type: "string" },
    fax: { type: "string" },
    telephone: { type: "number", required: true },
    isDeleted: { type: "boolean", required: true }
  }
});
