const { name } = require("./about.js");

const list = async (root, args, { db: { collections } }) => {
  const where = Object.assign({}, args.where, { isDeleted: false });
  const entries = await collections[name].find({ where });
  return entries;
};

const single = async (root, args, { db: { collections } }) => {
  const id = args.id || (args[name] && args[name].id);
  const entry = await collections[name].findOne({ id, isDeleted: false });
  return entry;
};

const nested = {
  scheme_of_work: {
    subject: async (root, args, { db: { collections } }) => {
      if (!root.subject) return null;
      return await collections.subject.findOne({ id: root.subject });
    },
    term: async (root, args, { db: { collections } }) => {
      if (!root.term) return null;
      return await collections.term.findOne({ id: root.term });
    },
    teacher: async (root, args, { db: { collections } }) => {
      if (!root.teacher) return null;
      return await collections.teacher.findOne({ id: root.teacher });
    }
  }
};

export { list, single, nested };
