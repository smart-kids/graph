var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    national_id: { type: "string", required: true },
    name: { type: "string", required: true },
    password: { type: "string", required: false },
    phone: { type: "string", required: true },
    email: { type: "string", required: true },
    school: { type: "string", required: false },
    gender: { type: "string", required: true },
    google_id: { type: "string", required: false },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
