const uuid = require("uuidv4");
const name = "configurations";

const { UserError } = require("graphql-errors");
const create = async (data, { db: { collections } }) => {
  const id = uuid();
  const entry = Object.assign(data[name], { id, isDeleted: false });

  try {
    await collections[name].create(entry);

    return true;
  } catch (err) {
    throw new UserError(err.details);
  }
};

const update = async (data, { db: { collections } }) => {
  const { company } = data[name];
  const entry = data[name];

  try {
    delete entry.company;

    await collections[name].update({ company }).set(entry);

    return true
  } catch (err) {
    console.log(err)
    throw new UserError(err.details);
  }
};

export default () => {
  return {
    create,
    update
  };
};
