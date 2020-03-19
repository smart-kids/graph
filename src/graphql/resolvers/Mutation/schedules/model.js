var Waterline = require("waterline");
const { name: identity } = require("../schedules/about.js");

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    name: { type: "string", required: true },
    time: { type: "string", required: true },
    end_time: { type: "string", required: true },
    days: { type: "string", required: true },
    route: { type: "string", required: false },
    actions: { type: "string", required: false },
    bus: { type: "string", required: false },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
