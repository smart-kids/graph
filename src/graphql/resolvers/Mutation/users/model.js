var Waterline = require("waterline");
const { name: identity } = require("./about.js");

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    names: { type: "string", required: true },
    password: { type: "string" },
    email: { type: "string", required: true },
    phone: { type: "string", required: true },
    other_phone: { type: "string" },
    mpesa_payments_phone: { type: "string" },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
