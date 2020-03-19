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
  schedule: {
    async actions(root, args, { db: { collections } }) {
      return root.actions ? JSON.parse(root.actions) : {};
    },
    async route(root, args, { db: { collections } }) {
      const entry = await collections["route"].findOne({
        where: { id: root.route, isDeleted: false }
      });
      return entry;
    },
    async trips(root, args, { db: { collections } }) {
      const entry = await collections["trip"].find({
        where: { schedule: root.id, isDeleted: false }
      });
      return entry;
    },
    async bus(root, args, { db: { collections } }) {
      const entry = await collections["bus"].findOne({
        where: { id: root.bus, isDeleted: false }
      });
      return entry;
    },
    async driver(root, args, { db: { collections } }) {
      const entry = await collections["driver"].findOne({
        where: { id: root.driver, isDeleted: false }
      });
      return entry;
    },
    async days(root, args, { db: { collections } }) {
      if (root.days) return root.days.split(",");
    }
  }
};

export { list, single, listDeleted, nested };
