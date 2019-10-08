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
    route: { type: "string", required: true },
    bus: { type: "string", required: true },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
