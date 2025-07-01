var Waterline = require("waterline");
const { name: identity } = require("./about.js");

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    value: { type: "string", required: true },
    question: { type: "string", required: true },
    correct: { type: "boolean", defaultsTo: false, allowNull: true },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
