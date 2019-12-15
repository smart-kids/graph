var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    username: { type: "string", required: true },
    email: { type: "string", required: true },
    phone: { type: "string", required: true },
    photo: { type: "string", required: true },
    license_expiry: { type: "string", required: true },
    licence_number: { type: "string", required: true },
    home: { type: "string", required: true },
    experience: { type: "string", required: true },
    password: { type: "string", required: false },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
