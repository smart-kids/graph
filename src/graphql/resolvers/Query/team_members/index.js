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
  team_member: {
    async team(root, args, { db: { collections } }) {
      const entry = await collections["team"].findOne({
        where: { id: root.team, isDeleted: false }
      });
      return entry;
    },
    async user(root, args, { db: { collections } }) {
        const entry = await collections["user"].findOne({
          where: { id: root.user, isDeleted: false }
        });
        return entry;
      },
  }
}

export { list, single, listDeleted, nested };
