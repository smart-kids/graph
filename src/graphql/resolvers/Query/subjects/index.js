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
  subject: {
    topicOrder: async (root, args, { db: { collections } }) => {
      return root.topicOrder ? JSON.parse(root.topicOrder) : [];
    },
    async grade(root, args, { db: { collections } }) {
      const entry = await collections["grade"].findOne({
        where: { id: root.grade, isDeleted: false }
      });
      return entry;
    },
    async topics(root, args, { db: { collections } }) {
      const entry = await collections["topic"].find({
        where: { subject: root.id, isDeleted: false }
      });
      return entry;
    },
  }
}

export { list, single, listDeleted, nested };
