import { ObjectId } from "mongodb"
const { name } = require("./about.js")
const prepareUser = require("../../../../utils/prepapreUser")
import roles from "../../../../utils/rolesMapping"

const { UserError } = require("graphql-errors");


const create = async (data, { auth, db: { collections } }) => {
  const id = new ObjectId().toHexString();
  const roleId = new ObjectId().toHexString();
  const entry = Object.assign(data[name], { id, isDeleted: false });
  const { school } = entry

  console.log({ auth })

  try {
    entry.password = undefined
    await collections[name].create(entry);

    const roleUser = {
      id: roleId,
      role: 1,
      user: id,
      school,
      isDeleted: false
    }

    console.log({ roleUser })

    await collections.user_role.create(roleUser);

    const readyUserObject = await prepareUser(entry)
    readyUserObject.id = entry.id.toString()
    await collections.users.create(await prepareUser(entry));

    return entry;
  } catch (err) {
    console.log(err)
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
