var Waterline = require("waterline");
const { name: identity } = require("./about.js")

module.exports = Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    school: { type: "string", required: true },
    name: { type: "string", required: true },
    subjectsOrder: { type: "json", defaultsTo: [] },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});