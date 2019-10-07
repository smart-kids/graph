var Waterline = require("waterline");
const { name: identity } = require("../schedules/about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    trip: { type: "string", required: true },
    startedAt: { type: "string", required: true },
    completedAt: { type: "string", required: true },
    trip: { type: "string", required: true },
    driver: { type: "string", required: true },
    isDeleted: { type: "boolean", required: true }
  }
});
