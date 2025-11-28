var Waterline = require("waterline");
const identity = "smslog";

module.exports = Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: 'string', required: true },
    event: {
      model: 'smsevent',
      required: true
    },
    
    school: { type: 'string' },
    recipientName: { type: 'string' },
    recipientPhone: { type: 'string' },
    compiledMessage: { type: 'string' },
    
    status: { type: 'string' },
    error: { type: 'string' },
    
    providerResponse: { type: 'json' },
    isDeleted: { type: 'boolean', defaultsTo: false },
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