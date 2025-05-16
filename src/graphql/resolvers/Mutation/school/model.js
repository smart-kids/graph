// your-model-file.js
var Waterline = require("waterline");
const { name: identity } = require("./about.js"); // Assuming ./about.js exports { name: 'school' }

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true }, // This will map to VARCHAR(24) due to your migration script's defaultId logic
    name: { type: "string", required: true },
    phone: { type: "string", required: true },
    email: { type: "string", required: true },
    address: { type: "string", required: true },
    logo: {
      type: "string", // Keep the base Waterline type as 'string'
      required: false,
      allowNull: true,
      autoMigrations: { // Or just `columnType: 'text'` directly if not using autoMigrations features
        columnType: 'text' // This tells the adapter (sails-postgresql) to use TEXT
      }
    },
    themeColor: { type: "string", required: false, allowNull: true },
    gradeOrder: { type: "string", required: false },
    termOrder: { type: "string", required: false },
    inviteSmsText: { type: "string", required: false },
    isDeleted: { type: "boolean", defaultsTo: false }
  }
});