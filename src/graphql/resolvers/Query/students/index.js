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
  student: {
    async route(root, args, { db: { collections } }) {
      const entry = await collections["route"].findOne({
        where: { id: root.route, isDeleted: false }
      });
      return entry;
    },
    async parent(root, args, { db: { collections } }) {
      const entry = await collections["parent"].findOne({
        where: { id: root.parent, isDeleted: false }
      });
      return entry;
    },
    async parent2(root, args, { db: { collections } }) {
      const entry = await collections["parent"].findOne({
        where: { id: root.parent2, isDeleted: false }
      });
      return entry;
    },
    async events(root, args, { db: { collections } }) {
      const entry = await collections["event"].find({
        where: { student: root.id, isDeleted: false }
      });
      return entry;
    },
    async class(root, args, { db: { collections } }) {
      const entry = await collections["class"].find({
        where: { id: root.class, isDeleted: false }
      });
      return entry;
    }
  }
}

export { list, single, listDeleted, nested };
