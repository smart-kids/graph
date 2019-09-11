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
  schedule: {
    async route(root, args, { db: { collections } }) {
      console.log(root)
      const entry = await collections["route"].find({
        where: { id: root.route, isDeleted: false }
      });
      return entry;
    },
    async bus(root, args, { db: { collections } }) {
      const entry = await collections["bus"].find({
        // where: { isDeleted: false }
      });
      return entry;
    },
    async days(root, args, { db: { collections } }) {
      if (root.days)
        return root.days.split(",");
    },
  }
}


export { list, single, listDeleted, nested };
