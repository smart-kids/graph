import { ObjectId } from "mongodb"
const { name } = require("./about.js")

const { UserError } = require("graphql-errors");

const create = async (data, { db: { collections } }) => {
  const id = new ObjectId().toHexString();
  const inviteSmsText = `Hello {{username}}, 

You have been invited to join {{team_name}} on ShulePlus.

access admin here https://cloud.shuleplus.co.ke

use 

phone nunber: {{phone_number}}
password: {{password}}`;
  
  let { gradeOrder } = data[name];
  let { termOrder } = data[name];
  gradeOrder = gradeOrder ? gradeOrder.join(",") : "";
  termOrder = termOrder ? termOrder.join(",") : "";

  const entry = Object.assign(data[name], { inviteSmsText, gradeOrder, termOrder, id, isDeleted: false });

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
  let { gradeOrder } = entry;
  entry.gradeOrder = gradeOrder ? gradeOrder.join(",") : "";
  let { termOrder } = entry;
  entry.termOrder = termOrder ? termOrder.join(",") : "";

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


const pay = async (data, { db: { collections } }) => {
  const { id } = data[name];

  try {
    await collections[name].findOne({ id, isDeleted: false })

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
