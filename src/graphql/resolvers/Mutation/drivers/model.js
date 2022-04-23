var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    userId: { type: "string", required: true },
    school: { type: "string", required: false },
    names: { type: "string", required: true },
    phone: { type: "string", required: true },
    license_expiry: { type: "string", required: false },
    licence_number: { type: "string", required: false },
    home: { type: "string", required: false },
    experience: { type: "string", required: false },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
