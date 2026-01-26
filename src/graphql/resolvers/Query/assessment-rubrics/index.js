const { name } = require("./about.js")

const list = async (root, args, { db: { collections } }) => {
  const where = args.where || { isDeleted: false };
  if (where.isDeleted === undefined) where.isDeleted = false;
  
  const entries = await collections[name].find({ where });
  return entries;
};

const single = async (root, args, { db: { collections } }) => {
  const { id } = args;

  const entry = await collections[name].findOne({
    where: { id, isDeleted: false }
  });
  return entry;
};

const nested = {
  assessmentRubric: {
    async school(root, args, { db: { collections } }) {
      return await collections["school"].findOne({
        where: { id: root.school }
      });
    },
  }
}

export { list, single, nested };
