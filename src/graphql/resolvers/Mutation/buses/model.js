var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    make: { type: "string", required: true },
    plate: { type: "string", required: true },
    size: { type: "string", required: true },
    driver: { type: "string", required: true },
    isDeleted: { type: "boolean", required: true }
  }
});
