var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    school: { type: "string", required: false },
    name: { type: "string", required: true },
    description: { type: "string", required: false },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
