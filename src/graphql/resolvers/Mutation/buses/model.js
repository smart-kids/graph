var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    school: { type: "string", required: false },
    make: { type: "string", required: true },
    plate: { type: "string", required: true },
    size: { type: "string", required: true },
    driver: { type: "string", required: false },
    isDeleted: { type: "boolean", defaultsTo: false },
    createdAt: { type: "string" },
    updatedAt: { type: "string" }
  },

  beforeCreate: function(values, proceed) {
    const now = new Date().toISOString();
    values.createdAt = values.createdAt || now;
    values.updatedAt = values.updatedAt || now;
    return proceed();
  },

  beforeUpdate: function(values, proceed) {
    values.updatedAt = new Date().toISOString();
    return proceed();
  }
});
