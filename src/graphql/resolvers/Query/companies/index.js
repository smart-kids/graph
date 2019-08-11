const name = "company";

const list = async (root, args, { db: { collections } }) => {
  const entries = await collections[name].find();
  return entries;
};

const single = async (root, args, { db: { collections } }) => {
  const { id } = args[name];
  
  const entry = await collections[name].findOne({
    where: { id }
  });

  return entry;
};

export { list, single };
