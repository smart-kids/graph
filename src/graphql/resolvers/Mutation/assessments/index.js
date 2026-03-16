import { ObjectId } from "mongodb"
const { name } = require("./about.js")

const { UserError } = require("graphql-errors");

const create = async (data, { db: { collections } }) => {
  const id = new ObjectId().toHexString();
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
    bulkSave: async (data, { db: { collections } }) => {
      const assessments = data.assessments || [];
      const results = [];

      for (const entryData of assessments) {
        try {
          if (entryData.id) {
            const { id } = entryData;
            const entry = { ...entryData };
            delete entry.id;
            await collections[name].update({ id }).set(entry);
            const updated = await collections[name].findOne({ id });
            results.push(updated);
          } else {
            const id = new ObjectId().toHexString();
            const entry = Object.assign(entryData, { id, isDeleted: false });
            await collections[name].create(entry);
            results.push(entry);
          }
        } catch (err) {
          console.error("Error in bulkSave for assessment", err);
          throw new UserError(err.details || err.message);
        }
      }

      return results;
    }
  };
};
