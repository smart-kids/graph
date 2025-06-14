var Waterline = require("waterline");
const { name: identity } = require("./about.js");

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    value: { type: "string", required: true },
    question: { type: "string", required: true },
    videos: { type: "json", defaultsTo: [] },
    attachments: { type: "json", defaultsTo: [] },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
