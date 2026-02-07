const { name } = require("../../Mutation/library/about.js");
const DataLoader = require('dataloader');

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

const booksLoaders = (collections) => {
  const createByIdLoader = (collectionName) => {
    return new DataLoader(async (keys) => {
      console.log(`\n[DATALOADER BATCH] Firing batch request for collection '${collectionName}' by ID with ${keys.length} keys:`, keys);
      const items = await collections[collectionName].find({
        where: { id: { in: keys } }
      });
      return keys.map(key => items.find(item => item.id === key) || null);
    });
  };

  const createRelatedLoader = (collectionName, foreignKey) => {
    return new DataLoader(async (keys) => {
      console.log(`\n[DATALOADER BATCH] Firing batch request for collection '${collectionName}' with ${keys.length} keys on foreign key '${foreignKey}':`, keys);
      const items = await collections[collectionName].find({
        where: { [foreignKey]: { in: keys } }
      });
      return keys.map(key => items.filter(item => item[foreignKey] === key));
    });
  };

  return {
    bookById: createByIdLoader(name),
    booksBySchoolId: createRelatedLoader(name, 'school'),
  };
};

export { list, single, nested, booksLoaders };
