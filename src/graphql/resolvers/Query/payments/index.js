const { name } = require("./about.js");

const list = async (root, args, { db: { collections } }) => {
  // 1. Prepare default query
  const query = {
    where: {
      isDeleted: false
    }
  };

  // 2. Handle Context (e.g., if querying payments inside a specific School)
  // If 'root' exists and looks like a School, filter by that School's ID
  if (root && root.id && !root.isDeleted) {
    query.where.school = root.id;
  }

  // 3. Handle Pagination (from GraphQL args)
  const limit = args.limit || 1000;
  const skip = args.offset || 0;

  // 4. Fetch Data
  // CRITICAL: We .sort('createdAt DESC') so your Timeline UI shows the latest activity first
  const entries = await collections[name].find(query)
    .limit(limit)
    .skip(skip)
    .sort('createdAt DESC');

  return entries;
};

const listDeleted = async (root, args, { db: { collections } }) => {
  const query = {
    where: {
      isDeleted: true
    }
  };

  if (root && root.id) {
    query.where.school = root.id;
  }

  const entries = await collections[name].find(query)
    .sort('updatedAt DESC');

  return entries;
};

export { list, listDeleted };