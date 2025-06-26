const { name } = require("./about.js")

const list = async (root, args, { db: { collections } }) => {
  const entries = await collections[name].find({
    where: {
      isDeleted: false
    }
  });
  return entries;
};

const listDeleted = async (root, args, { db: { collections } }) => {
  const entries = await collections[name].find({
    where: {
      isDeleted: true
    }
  });
  return entries;
};

const single = async (root, args, { db: { collections } }) => {
  const { id } = args[name];

  const entry = await collections[name].findOne({
    where: { id, isDeleted: false }
  });
  return entry;
};

const nested = {
  topic: {
    subtopicOrder: async (root, args, { db: { collections } }) => {
      return root.subtopicOrder ? JSON.parse(root.subtopicOrder) : [];
    },
    async subject(root, args, { db: { collections } }) {
      const entry = await collections["subject"].findOne({
        where: { id: root.subject, isDeleted: false }
      });
      return entry;
    },
    async subtopics(root, args, { db: { collections } }) {
      const entry = await collections["subtopic"].find({
        where: { topic: root.id, isDeleted: false }
      });
      return entry;
    },
  }
}

export { list, single, listDeleted, nested };
