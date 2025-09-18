var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    user: { type: "string", required: true },
    password: { type: "string", required: true },
    used: { type: "boolean", defaultsTo: false },
    usedAt: { type: "ref", required: false },
    // For Handling Sorting in Querys
    // Let Waterline manage the timestamp. It will expect a Date object.
    createdAt: { 
      type: 'ref', // 'ref' is for any type that isn't string, number, etc., like a Date object.
      autoCreatedAt: true, // This tells Waterline this is a "created at" timestamp.
      autoMigrations: { columnType: 'timestamptz' } // Ensures the DB column is correct.
    },
    
    // You should also add updatedAt for completeness
    updatedAt: {
      type: 'ref',
      autoUpdatedAt: true,
      autoMigrations: { columnType: 'timestamptz' }
    }
  }
});
