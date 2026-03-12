import { UserError } from "graphql-errors";

const list = async (_, args, { db: { collections } }) => {
  try {
    const list = await collections["chargetype"]
      .find({
        isDeleted: false,
        school: args.where.school
      })
      .sort("createdAt DESC");

    return list;
  } catch (err) {
    throw new UserError(err.details);
  }
};

const single = async (_, args, { db: { collections } }) => {
  const { id } = args;

  try {
    const entry = await collections["chargetype"].findOne({ id });
    return entry;
  } catch (err) {
    throw new UserError(err.details);
  }
};

export { list, single };
