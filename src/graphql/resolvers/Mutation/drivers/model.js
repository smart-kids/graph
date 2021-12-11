var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    school: { type: "string", required: false },
    username: { type: "string", required: true },
    email: { type: "string", required: false },
    phone: { type: "string", required: true },
    photo: { type: "string", required: false },
    license_expiry: { type: "string", required: false },
    licence_number: { type: "string", required: false },
    home: { type: "string", required: false },
    experience: { type: "string", required: false },
    password: { type: "string", required: false },
    google_id: { type: "string", required: false },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
