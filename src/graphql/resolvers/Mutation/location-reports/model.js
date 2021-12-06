var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    time: { type: "string", required: true },
    loc: { type: "string", required: true },
    trip: { type: "string", required: false },
    event: { type: "string", required: false },
    student: { type: "string", required: false },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
