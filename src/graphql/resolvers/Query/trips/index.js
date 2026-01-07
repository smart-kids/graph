const { name } = require("./about.js");

const list = async (root, args, { db: { collections } }) => {
  const where = Object.assign({}, args.where || {}, { isDeleted: false });
  const entries = await collections[name].find({
    where
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
  [name]: {
    async bus(
      root,
      args,
      {
        db: { collections }
      }
    ) {
      const entry = await collections["bus"].findOne({
        where: { id: root.bus, isDeleted: false }
      });
      return entry;
    },
    async driver(
      root,
      args,
      {
        db: { collections }
      }
    ) {
      const entry = await collections["driver"].findOne({
        where: { id: root.driver, isDeleted: false }
      });
      return entry;
    },
    async events(
      root,
      args,
      {
        db: { collections }
      }
    ) {
      const entry = await collections["event"].find({
        where: { trip: root.id, isDeleted: false }
      });
      return entry;
    },
    async locReports(
      root,
      args,
      {
        db: { collections }
      }
    ) {
      const entry = await collections["locreport"].find({
        where: { trip: root.id, isDeleted: false }
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
      const entry = await collections["schedule"].findOne({
        where: { id: root.schedule, isDeleted: false }
      });
      return entry;
    }
  }
};

export { list, single, listDeleted, nested };
