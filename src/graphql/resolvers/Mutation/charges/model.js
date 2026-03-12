var Waterline = require("waterline");
const { name: identity } = require("./about.js");

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    school: { type: "string", required: true },
    parent: { type: "string", required: false },
    chargeType: { type: "string", required: false },
    amount: { type: "number", required: true },
    reason: { type: "string", required: true },
    time: { type: "string", required: true },
    term: { type: "string", required: false },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
