var Waterline = require("waterline");
const { name: identity } = require("./about.js");

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    label: { type: "string", required: true },
    minScore: { type: "number", required: true },
    maxScore: { type: "number", required: true },
    points: { type: "number", defaultsTo: 0 },
    teachersComment: { type: "string" },
    school: { type: "string", required: true },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
