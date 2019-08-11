var Waterline = require("waterline");

export default Waterline.Collection.extend({
  identity: "configurations",
  datastore: "default",
  primaryKey: "company",

  attributes: {
    company: { type: "string", required: true },
    // mail configs
    emailMailer: { type: "string" },
    emailHost: { type: "string" },
    emailEncrypt: { type: "string" },
    emailFrom: { type: "string" },
    emailUsername: { type: "string" },
    emailPort: { type: "string" },

    // charge settings
    minimumSwitchDuration: { type: "number" },
    transfer: { type: "number" },
    printing: { type: "number" },
    minimumTransferDuration: { type: "number" },
    membership: { type: "number" },
    switch: { type: "number" },
    bounceCheque: { type: "number" },

    // system params
    minimumNavChart: { type: "number" },
    dividendsTax: { type: "number" },
    exerciseTax: { type: "number" },
    withholdingResident: { type: "number" },
    maxJointMembers: { type: "number" },
    vat: { type: "number" },
    withholdingNonResident: { type: "number" },

    // transaction settings
    withdrawal: { type: "number" },
    duration: { type: "number" },
    minimumWithdrawalDuration: { type: "number" },

    // sms settings
    smsPort: { type: "string" },
    isDeleted: { type: "boolean", required: true }
  }
});
