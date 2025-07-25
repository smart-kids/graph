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
  subtopic: {
    questionsOrder: async (root, args, { db: { collections } }) => {
      return root.questionsOrder ? JSON.parse(root.questionsOrder) : [];
    },
    topic: async (root, args, { db: { collections } }) => {
      const entry = await collections["topic"].findOne({
        where: { id: root.topic, isDeleted: false }
      });
      return entry;
    },
    questions: async (root, args, { db: { collections } }) => {
      const entry = await collections["question"].find({
        where: { subtopic: root.id, isDeleted: false }
      });
      return entry;
    },
  }
}

export { list, single, listDeleted, nested };
