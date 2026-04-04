var Waterline = require("waterline");
const { name: identity } = require("./about.js");

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",
  attributes: {
    id: { type: "string", required: true },
    school: { type: 'string', required: true },
    subject: { type: 'string', required: true },
    term: { type: 'string' },
    teacher: { type: 'string' },
    
    strand: { type: 'string' },
    substrands: { type: 'string' },
    
    learningoutcomes: { type: 'string' },
    keyenquiringquestions: { type: 'string' },
    learningresources: { type: 'string' },
    introduction: { type: 'string' },
    lessondevelopment: { type: 'string' },
    conclusion: { type: 'string' },
    extendedactivity: { type: 'string' },
    reflection: { type: 'string' },
    
    isDeleted: { type: 'boolean', defaultsTo: false },
    createdAt: { type: 'ref', autoCreatedAt: true },
    updatedAt: { type: 'ref', autoUpdatedAt: true }
  }
});
