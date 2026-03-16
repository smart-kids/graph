import { ObjectId } from "mongodb"
const { name } = require("./about.js")

const { UserError } = require("graphql-errors");

const create = async (data, { db: { collections } }) => {
  const id = new ObjectId().toHexString();
  const entry = { ...data[name], id, isDeleted: false };

  try {
    await collections[name].create(entry);

    return entry;
  } catch (err) {
    console.error(`Error creating ${name}:`, err);
    throw new UserError(err.details || err.message || "An error occurred during creation");
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
    throw new UserError(err.details || err.message || "An error occurred during update");
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
    throw new UserError(err.details || err.message || "An error occurred during archive");
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
    throw new UserError(err.details || err.message || "An error occurred during restore");
  }
};

const updateOrder = async ({ orders }, { db: { collections } }) => {
  try {
    for (const { id, order } of orders) {
      await collections[name].update({ id }).set({ order });
    }
    return true;
  } catch (err) {
    console.error("Error updating assessment type orders:", err);
    throw new UserError(err.details || err.message || "An error occurred during order update");
  }
};

export default () => {
  return {
    create,
    update,
    updateOrder,
    archive,
    restore
  };
};
