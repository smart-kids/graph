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
    password: { type: "string" },
    school: { type: "string" },
    google_id: { type: "string", required: false },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
