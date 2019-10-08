var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    names: { type: "string", required: true },
    route: { type: "string", required: true },
    gender: { type: "string", required: true },
    parent: { type: "string", required: true },
    parent2: { type: "string", required: true },
    registration: { type: "string", required: true },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
