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
  route: {
    async path(
      root,
      args,
      {
        db: { collections }
      }
    ) {
      return root.path;
    },
    async students(
      root,
      args,
      {
        db: { collections }
      }
    ) {
      const entry = await collections["student"].find({
        where: { route: root.id, isDeleted: false }
      });
      return entry;
    },
    async schedule(
      root,
      args,
      {
        db: { collections }
      }
    ) {
      const entry = await collections["schedule"].find({
        where: { route: root.id, isDeleted: false }
      });
      console.log(entry)
      return entry;
    }
  }
};

export { list, single, listDeleted, nested };
