var Waterline = require("waterline");

export default Waterline.Collection.extend({
  identity: "agent",
  datastore: "default",
  primaryKey: "id",

  attributes: {
    id: { type: "string", required: true },
    surname: { type: "string", required: true },
    othername: { type: "string", required: true },
    dob: { type: "string", required: true },
    gender: { type: "string", required: true },
    agentType: { type: "string", required: true },
    bank: { type: "string", required: true },
    bankAccountNumber: { type: "number", required: true },
    postalAddress: { type: "string", required: true },
    kraPinNo: { type: "number", required: true },
    idPassportNumber: { type: "number", required: true },
    mobileNumber: { type: "number", required: true },
    email: { type: "string", required: true },
    agentCategory: { type: "string", required: true },
    bankBranch: { type: "string", required: true },
    postalCode: { type: "string", required: true },
    physicalAddress: { type: "string", required: true },
    isDeleted: { type: "boolean", required: true }
  }
});
