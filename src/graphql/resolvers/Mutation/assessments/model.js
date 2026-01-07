var Waterline = require("waterline");
const { name: identity } = require("./about.js");

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    student: { type: "string", required: true },
    term: { type: "string", required: true },
    subject: { type: "string", required: true },
    score: { type: "number", required: true },
    outOf: { type: "number", defaultsTo: 100 },
    teacher: { type: "string" },
    school: { type: "string", required: true },
    remarks: { type: "string" },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
