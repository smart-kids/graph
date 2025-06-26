var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    subtopic: { type: "string", required: true },
    name: { type: "string", required: true },
    type: { type: "string", required: true },
    videos: { type: "json", defaultsTo: [] },
    attachments: { type: "json", defaultsTo: [] },
    images: { type: "json", defaultsTo: [] },
    optionsOrder: { type: "json", defaultsTo: [] },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
