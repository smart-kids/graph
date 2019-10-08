var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    parent: { type: "string", required: true },
    content: { type: "string", required: true },
    time: { type: "string", required: true },
    isDeleted: { type:"boolean", required: true }
  }
});
