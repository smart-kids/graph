const { name } = require("../../Mutation/library/about.js");

const list = async (args, { db: { collections } }) => {
  const where = Object.assign({ isDeleted: false }, args.where || {});
  try {
    const books = await collections[name].find(where).sort("createdAt DESC");
    return books;
  } catch (err) {
    console.error("Error fetching books:", err);
    return [];
  }
};

const single = async (args, { db: { collections } }) => {
  const { id } = args;
  try {
    const book = await collections[name].findOne({ id, isDeleted: false });
    return book;
  } catch (err) {
    console.error(`Error fetching book ${id}:`, err);
    return null;
  }
};

const nested = {
  book: {
    school: async (parent, args, { db: { collections } }) => {
      try {
        return await collections.school.findOne({ id: parent.school });
      } catch (err) {
        return null;
      }
    }
  }
};

export { list, single, nested };
