import { ObjectId } from "mongodb"
import argon2 from "argon2"
const { name } = require("./about.js")
import Handlebars from "handlebars"
import sms from "../../../../utils/sms"
import generatePassword from "../../../../utils/generatePassword"

const { UserError } = require("graphql-errors");

const create = async (data, { db: { collections } }) => {
  const id = new ObjectId().toHexString();

  const password = await argon2.hash(data[name].password || '');
  const entry = Object.assign(data[name], { id, password, isDeleted: false });

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

    if (entry.password) {
      const hashedPassword = await argon2.hash(entry.password);
      entry.password = hashedPassword
    }

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

const invite = async (data, { db: { collections } }) => {
  const { school, user } = data[name]

  try {
    const parent = await collections["parent"].findOne({ where: { id: user, isDeleted: false } })
    const inviteSmsText = `
Hello {{username}}, 

You have been invited to join ShulePlus.

access admin here https://cloud.shuleplus.co.ke

use the following details to login:

phone number: {{phone_number}}
password: {{password}}`;

    const template = Handlebars.compile(inviteSmsText)
    const password = generatePassword()
    const hashedPassword = await argon2.hash(password);
    const phone = parent.phone;
    const smsTemplateData = {
      username: parent.name, phone_number: phone, password
    }
    const message = template(smsTemplateData)

    sms({ data: { phone, message } },
      async (res) => {
        const { smsCost } = res
        await collections["charge"].create({
          id: new ObjectId().toHexString(),
          school,
          ammount: smsCost,
          reason: `Sending message '${message}'`,
          time: new Date(),
          isDeleted: false
        })
      }
    )
    await collections["parent"].update({ id: parent.id }).set({ password: hashedPassword });

    const id = new ObjectId().toHexString();
    const entry = Object.assign({ id, school, user, message, phone, email: parent.email, isDeleted: false });

    await collections["invitation"].create(entry);
    return {
      id,
      message,
      phone
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
    invite,
  };
};
