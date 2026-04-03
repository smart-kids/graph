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
    
    week: { type: 'number' },
    dateofteaching: { type: 'string' },
    strand: { type: 'string' },
    substrands: { type: 'string' },
    
    learningoutcomes: { type: 'string' },
    lessoncovered: { type: 'string' },
    keyactivities: { type: 'string' },
    assignments: { type: 'string' },
    isDeleted: { type: 'boolean', defaultsTo: false },
    createdAt: { type: 'ref', autoCreatedAt: true },
    updatedAt: { type: 'ref', autoUpdatedAt: true }
  }
});
