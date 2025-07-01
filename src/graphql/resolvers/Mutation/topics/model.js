var Waterline = require("waterline");
const { name: identity } = require("./about.js");

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    name: { type: "string", required: true },
    subject: { type: "string", required: true },
    icon: { type: "string", required: false, allowNull: true },
    subtopicsOrder: { type: "json", defaultsTo: [] },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});