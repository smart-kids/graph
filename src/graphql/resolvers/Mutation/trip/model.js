var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    startedAt: { type: "string", required: true },
    completedAt: { type: "string", required: true },
    schedule: { type: "string", required: true },
    driver: { type: "string", required: false },
    bus: { type: "string", required: false },
    isDeleted: { type: "boolean", required: true }
  }
});
