var Waterline = require("waterline");
const { name: identity } = require("../schedules/about.js");

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    name: { type: "string", required: true },
    school: { type: "string", required: false },
    time: { type: "string", required: true },
    end_time: { type: "string", required: true },
    type: { type: "string", required: true },
    days: { type: "json", defaultsTo: [] },
    route: { type: "string", required: false },
    actions: { type: "string", required: false },
    bus: { type: "string", required: false },
    message: { type: "string", required: false },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
