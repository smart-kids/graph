const name = "company";

export default async (root, args, { db: { collections } }) => {
  const entries = await collections[name].find();
  return entries;
};
