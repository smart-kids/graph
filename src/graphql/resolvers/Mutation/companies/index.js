const uuid = require("uuidv4");
const name = "company";

const { UserError } = require("graphql-errors");

const create = async (data, { db: { collections } }) => {
  const id = uuid();
  const entry = Object.assign(data[name], { id });

  try {
    await collections[name].create(entry);

    return entry;
  } catch (err) {
    throw new UserError(err.details);
  }
};

export default () => {
  return {
    create
  };
};
