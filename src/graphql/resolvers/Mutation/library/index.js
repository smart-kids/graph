import { ObjectId } from "mongodb";
const { name } = require("./about.js");
const { UserError } = require("graphql-errors");

const create = async (data, { auth, db: { collections } }) => {
  const id = new ObjectId().toHexString();
  const entry = Object.assign(data[name], { id, isdeleted: false });

  try {
    await collections[name].create(entry);
    return entry;
  } catch (err) {
    console.error("Error creating book:", err);
    throw new UserError("Failed to create book.");
  }
};

const update = async (data, { db: { collections } }) => {
  const { id, ...payload } = data[name];

  if (!id) {
    throw new UserError("ID is required for update.");
  }

  try {
    await collections[name].update({ id }).set(payload);
    return { id };
  } catch (err) {
    console.error(`Error updating book ${id}:`, err);
    throw new UserError("An error occurred during the update process.");
  }
};

const archive = async (data, { db: { collections } }) => {
  const { id } = data[name];
  try {
    await collections[name].update({ id }).set({ isdeleted: true });
    return { id };
  } catch (err) {
    throw new UserError("Failed to archive book.");
  }
};

const restore = async (data, { db: { collections } }) => {
  const { id } = data[name];
  try {
    await collections[name].update({ id }).set({ isdeleted: false });
    return { id };
  } catch (err) {
    throw new UserError("Failed to restore book.");
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
