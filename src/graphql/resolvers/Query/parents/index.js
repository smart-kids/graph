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

const single = async (root, args, { db: { collections }, auth }) => auth.user

const nested = {
  parent: {
    async students(root, args, { db: { collections } }) {
      const entry = await collections["student"].find({
        where: { parent: root.parent, isDeleted: false }
      });
      return entry;
    },
    async complaints(root, args, { db: { collections } }) {
      const entry = await collections["complaint"].find({
        where: { parent: root.id, isDeleted: false }
      });
      return entry;
    }
  }
}


export { list, single, listDeleted, nested };
