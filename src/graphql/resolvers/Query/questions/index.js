const { name } = require("./about.js");

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
  question: {
    async subtopic(root, args, { db: { collections }}) {
      const entry = await collections["subtopic"].findOne({
        where: { id: root.subtopic, isDeleted: false }
      });
      return entry;
    },
    async answers(root, args, { db: { collections } }) {
      const entry = await collections["answer"].find({
        where: { question: root.id, isDeleted: false }
      });
      return entry;
    },
    async options(root, args, { db: { collections } }) {
      const entry = await collections["option"].find({
        where: { question: root.id, isDeleted: false }
      });
      return entry;
    },
  }
};

export { list, single, listDeleted, nested };
