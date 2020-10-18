import schedules from "../../Mutation/schedules/index.js";

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
  const entries = await collections[name].find({
    where: {
      isDeleted: false
    }
  });
  return entries[0];
};

const nested = {
  school: {
    async students(root, args, { db: { collections } }) {
      const entries = await collections["student"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async buses(root, args, { db: { collections } }) {
      const entries = await collections["bus"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async complaints(root, args, { db: { collections } }) {
      const entries = await collections["complaint"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async drivers(root, args, { db: { collections } }) {
      const entries = await collections["driver"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async parents(root, args, { db: { collections } }) {
      const entries = await collections["parent"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async routes(root, args, { db: { collections } }) {
      const entries = await collections["route"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async trips(root, args, { db: { collections } }) {
      const entries = await collections["trip"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async schedules(root, args, { db: { collections } }) {
      const entries = await collections["schedule"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    }
  }
};

export { list, single, listDeleted, nested };
