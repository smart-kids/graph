var Waterline = require("waterline");
const { name: identity } = require("./about.js");

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    team: { type: "string", required: true },
    user: { type: "string", required: true },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});