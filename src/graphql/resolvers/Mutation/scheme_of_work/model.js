var Waterline = require("waterline");
const { name: identity } = require("./about.js");

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",
  attributes: {
    school: { type: 'string', required: true },
    subject: { type: 'string', required: true },
    term: { type: 'string' },
    teacher: { type: 'string' },
    
    week: { type: 'number' },
    lessonnumber: { type: 'number' },
    strand: { type: 'string' },
    substrands: { type: 'string' },
    
    learningoutcomes: { type: 'string' },
    keyenquiringquestions: { type: 'string' },
    learningexperience: { type: 'string' },
    corecompetencies: { type: 'string' },
    valueslearnt: { type: 'string' },
    learningresources: { type: 'string' },
    assessment: { type: 'string' },
    reflection: { type: 'string' },
    isDeleted: { type: 'boolean', defaultsTo: false },
    createdAt: { type: 'ref', autoCreatedAt: true },
    updatedAt: { type: 'ref', autoUpdatedAt: true }
  }
});
