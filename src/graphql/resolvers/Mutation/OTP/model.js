var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    user: { type: "string", required: true },
    userId: { type: "string", required: true },
    userType: { type: "string", required: true },
    password: { type: "string", required: true },
    used: { type: "boolean", defaultsTo: false }
  }
});
