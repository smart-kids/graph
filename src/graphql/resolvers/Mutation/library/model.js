import Waterline from "waterline";
const { name: identity } = require("./about.js");

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    title: { type: "string", required: true },
    author: { type: "string", required: true },
    category: { type: "string", required: true },
    coverUrl: { type: "string" },
    pdfUrl: { type: "string", required: true },
    description: { type: "string" },
    school: { type: "string", required: true },
    isDeleted: { type: "boolean", defaultsTo: false },
    
    createdAt: { 
      type: 'ref',
      autoCreatedAt: true,
      autoMigrations: { columnType: 'timestamptz' }
    },
    updatedAt: {
      type: 'ref',
      autoUpdatedAt: true,
      autoMigrations: { columnType: 'timestamptz' }
    }
  }
});
