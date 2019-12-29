const { name } = require("./about.js")

const single = async (root, args, { db: { collections } }) => {
  const entries = await collections[name].find({
    where: {
      isDeleted: false
    }
  });
  return entries[0];
};

export { single };
