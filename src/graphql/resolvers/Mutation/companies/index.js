const uuid = require("uuidv4");
const name = "company";

import configurations from "./configurations";
import securities from "./securities";
import agents from "./agents";
import members from "./members";

const { UserError } = require("graphql-errors");

const create = async (data, { db: { collections } }) => {
  const id = uuid();
  const entry = Object.assign(data[name], { id, isDeleted: false });

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
    restore,
    configurations,
    securities,
    agents,
    members
  };
};
