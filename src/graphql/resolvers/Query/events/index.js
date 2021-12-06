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
  event: {
    async student(
      root,
      args,
      {
        db: { collections }
      }
    ) {
      const entry = await collections["student"].findOne({
        where: { id: root.student, isDeleted: false }
      });
      return entry;
    },
    async trip(
      root,
      args,
      {
        db: { collections }
      }
    ) {
      const entry = await collections["trip"].findOne({
        where: { id: root.trip, isDeleted: false }
      });
      return entry;
    },
    async locReport(
      root,
      args,
      {
        db: { collections }
      }
    ) {
      const entry = await collections["locreport"].findOne({
        where: { event: root.id, isDeleted: false }
      });
      return entry;
    },
  }
};

export { list, single, listDeleted, nested };
