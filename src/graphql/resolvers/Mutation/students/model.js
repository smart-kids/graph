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
    paidFees: { type: "number", defaultsTo: 0 },
    isDeleted: { type: "boolean", defaultsTo: false },
    // --- FIX ---
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
