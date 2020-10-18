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
  if (auth.userType == 'parent')
    return auth.user

  return null;
}

const nested = {
  parent: {
    async students(root, args, { db: { collections } }) {
      const parent1 = await collections["student"].find({
        where: { parent: root.id, isDeleted: false }
      });

      const parent2 = await collections["student"].find({
        where: { parent2: root.id, isDeleted: false }
      });
      return [...parent1, ...parent2];
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
