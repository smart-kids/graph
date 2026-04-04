var Waterline = require("waterline");
const { name: identity } = require("./about.js");

export default Waterline.Collection.extend({
  identity,
  datastore: "default",
  primaryKey: "id",
  attributes: {
    id: { type: "string", required: true },
    school: { type: 'string', required: true },
    student: { type: 'string', required: true },
    subject: { type: 'string' },
    term: { type: 'string' },
    teacher: { type: 'string' },
    
    strand: { type: 'string' },
    substrands: { type: 'string' },
    
    strengths: { type: 'string' },
    needs: { type: 'string' },
    outcome: { type: 'string' },
    experience: { type: 'string' },
    resources: { type: 'string' },
    methods: { type: 'string' },
    initiationDate: { type: 'string' },
    terminationDate: { type: 'string' },
    reflection: { type: 'string' },
    
    isDeleted: { type: 'boolean', defaultsTo: false },
    createdAt: { type: 'ref', autoCreatedAt: true },
    updatedAt: { type: 'ref', autoUpdatedAt: true }
  }
});
