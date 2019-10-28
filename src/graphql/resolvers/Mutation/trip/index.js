import { ObjectId } from "mongodb";
const { name } = require("./about.js");

const { UserError } = require("graphql-errors");

const create = async (data, { db: { collections }, auth }) => {
  const id = new ObjectId().toHexString();
  const entry = Object.assign(data[name], { id, isDeleted: false });

  // attatch data from the schedule
  const schedule = await collections["schedule"].findOne({
    where: { id: data[name].schedule, isDeleted: false }
  });

  if (schedule)
    entry.bus = schedule.bus;

  if (auth.user)
    entry.driver = auth.user.id;

  try {
    await collections[name].create(entry);

    return entry;
  } catch (err) {
    throw new UserError(err.details);
  }
};

const update = async (data, { db: { collections } }) => {
  const { id } = data[name];
  const entry = data[name];

  try {
    delete entry.id;

    await collections[name].update({ id }).set(entry);

    return {
      id
    };
  } catch (err) {
    throw new UserError(err.details);
  }
};

const archive = async (data, { db: { collections } }) => {
  const { id } = data[name];

  try {
    await collections[name].update({ id }).set({ isDeleted: true });

    return {
      id
    };
  } catch (err) {
    throw new UserError(err.details);
  }
};

const restore = async (data, { db: { collections } }) => {
  const { id } = data[name];

  try {
    await collections[name].update({ id }).set({ isDeleted: false });

    return {
      id
    };
  } catch (err) {
    throw new UserError(err.details);
  }
};

export default () => {
  return {
    create,
    update,
    archive,
    restore
  };
};
