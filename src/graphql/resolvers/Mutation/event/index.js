import { ObjectId } from "mongodb"
import sms from "../../../../utils/sms"
const { name } = require("./about.js")

const messageMap = {
  "CHECKEDON": "Your student has been picked up",
  "CHECKEDOFF": "Your student has been dropped off",
}

const { UserError } = require("graphql-errors");

const create = async (data, { db: { collections } }) => {
  const id = new ObjectId().toHexString();
  const entry = Object.assign(data[name], { id, isDeleted: false });
  
  const student = await collections["student"].findOne({
    where: { id: entry.student, isDeleted: false }
  });

  const parent = await collections["parent"].findOne({
    where: { id: student.parent, isDeleted: false }
  });

  console.log({ student, parent })

  try {
    await collections[name].create(entry);

    sms({ data: { phone: parent.phone, message: messageMap[entry.type] }}, console.log)

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
