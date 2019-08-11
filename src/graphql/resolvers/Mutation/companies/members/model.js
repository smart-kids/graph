var Waterline = require("waterline");

export default Waterline.Collection.extend({
  identity: "member",
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    name: { type: "string", required: true },
    mobile: { type: "number", required: true },
    email: { type: "string", required: true },
    regDate: { type: "string", required: true },
    confirmed: { type: "boolean", required: true },
    isDeleted: { type: "boolean", required: true }
  }
});
