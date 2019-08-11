const uuid = require("uuidv4");
const name = "expense";

const { UserError } = require("graphql-errors");

const create = async (data, { db: { collections } }) => {
  const id = uuid();
  const entry = Object.assign(data[name], { id, isDeleted: false });

  try {
    await collections[name].create(entry);

    return { id };
  } catch (err) {
    console.log(err);
    throw new UserError(err.details);
  }
};

const update = async (data, { db: { collections } }) => {
  const { id } = data[name];
  const entry = data[name];

  try {
    delete entry.id;

    await collections[name].update({ id }).set(entry);

    return { id };
  } catch (err) {
    throw new UserError(err.details);
  }
};

export default () => {
  return {
    create,
    update
  };
};
