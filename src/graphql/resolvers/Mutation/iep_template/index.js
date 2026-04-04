import { ObjectId } from "mongodb"
const { name } = require("./about.js")
const { UserError } = require("graphql-errors");

const create = async (args, context) => {
  const { db: { collections } } = context;
  const id = new ObjectId().toHexString();
  const entry = Object.assign(args[name], { id, isDeleted: false });
  try {
    await collections[name].create(entry);
    return entry;
  } catch (err) { throw new UserError(err.details || err.message); }
};

const update = async (args, context) => {
  const { db: { collections } } = context;
  const { id } = args[name];
  const entry = args[name];
  try {
    delete entry.id;
    await collections[name].update({ id }).set(entry);
    return { id };
  } catch (err) { throw new UserError(err.details || err.message); }
};

const archive = async (args, context) => {
  const { db: { collections } } = context;
  const { id } = args[name];
  try {
    await collections[name].update({ id }).set({ isDeleted: true });
    return { id };
  } catch (err) { throw new UserError(err.details || err.message); }
};

const restore = async (args, context) => {
  const { db: { collections } } = context;
  const { id } = args[name];
  try {
    await collections[name].update({ id }).set({ isDeleted: false });
    return { id };
  } catch (err) { throw new UserError(err.details || err.message); }
};

export default () => ({ create, update, archive, restore });
