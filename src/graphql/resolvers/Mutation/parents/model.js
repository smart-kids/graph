var Waterline = require("waterline");
const { name: identity } = require("./about.js")

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    school: { type: "string", required: false },
    national_id: { type: "string", required: false },
    name: { type: "string", required: true },
    password: { type: "string", required: false },
    phone: { type: "string", required: true },
    email: { type: "string", required: false },
    gender: { type: "string", required: false },
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
