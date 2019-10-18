var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    student: { type: "string", required: true },
    time: { type: "string", required: true },
    type: { type: "string", required: true },
    trip: { type: "string", required: true },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
