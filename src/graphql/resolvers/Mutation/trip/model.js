var Waterline = require("waterline");
const { name: identity } = require("./about.js");

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    school: { type: "string", required: false },
    type: { type: "string", required: true },
    startedAt: { type: "string", required: false },
    completedAt: { type: "string", required: false },
    schedule: { type: "string", required: true },
    isCancelled: { type: "boolean", defaultsTo: false },
    driver: { type: "string", required: false },
    bus: { type: "string", required: false },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
