var Waterline = require("waterline");
const identity = "smsevent";

module.exports = Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: 'string', required: true },
    school: { type: 'string', required: true },
    messageTemplate: { type: 'string' }, // The raw Handlebars template
    status: { type: 'string', defaultsTo: 'PROCESSING' }, // PROCESSING, COMPLETED, PARTIAL, FAILED
    
    // Stats
    recipientCount: { type: 'number', defaultsTo: 0 },
    successCount: { type: 'number', defaultsTo: 0 },
    failureCount: { type: 'number', defaultsTo: 0 },

    // Relation: One Event has many Logs
    logs: {
      collection: 'smslog',
      via: 'event'
    },
    isDeleted: { type: 'boolean', defaultsTo: false },
    // Timestamps
    createdAt: { 
      type: 'ref', 
      autoCreatedAt: true, 
      autoMigrations: { columnType: 'timestamptz' } 
    },
    
    updatedAt: {
      type: 'ref',
      autoUpdatedAt: true,
      autoMigrations: { columnType: 'timestamptz' }
    },
  }
});