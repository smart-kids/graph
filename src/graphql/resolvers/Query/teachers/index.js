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

const single = async (root, args, { db: { collections }, auth }) => {
  const { id } = args[name];

  const entry = await collections[name].findOne({
    where: { id, isDeleted: false }
  });
  return entry;
}

const nested = {
  [name]: {
    async classes(root, args, { db: { collections } }) {
      const entry = await collections["class"].find({
        where: { teacher: root.id, isDeleted: false }
      });
      return entry;
    },
  }
}


export { list, single, listDeleted, nested };
