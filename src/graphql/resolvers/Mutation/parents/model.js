var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    school: { type: "string", required: false },
    national_id: { type: "string", required: true },
    name: { type: "string", required: true },
    phone: { type: "string", required: true },
    email: { type: "string", required: true },
    gender: { type: "string", required: true },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
