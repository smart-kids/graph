var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    subtopic: { type: "string", required: true },
    name: {
      type: "string", // Keep the base Waterline type as 'string'
      required: false,
      allowNull: true,
      autoMigrations: { // Or just `columnType: 'text'` directly if not using autoMigrations features
        columnType: 'text' // This tells the adapter (sails-postgresql) to use TEXT
      }
    },
    type: { type: "string", required: true },
    videos: { type: "json", defaultsTo: [] },
    attachments: { type: "json", defaultsTo: [] },
    contentOrder: { type: "json", defaultsTo: [] },
    images: { type: "json", defaultsTo: [] },
    optionsOrder: { type: "json", defaultsTo: [] },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});
