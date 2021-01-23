var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    school: { type: "string", required: true },
    phone: { type: "string", required: true },
    message: { type: "string", required: true },
    email: { type: "string", required: false },
    user: { type: "string", required: false },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
