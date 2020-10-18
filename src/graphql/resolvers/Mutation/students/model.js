var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    names: { type: "string", required: true },
    route: { type: "string", required: false },
    school: { type: "string", required: false },
    gender: { type: "string", required: true },
    parent: { type: "string", required: false },
    parent2: { type: "string", required: false },
    registration: { type: "string", required: true },
    class: { type: "string", required: false },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
