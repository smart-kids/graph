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
  const { school: schoolId, user } = data[name]

  try {
    const school = await collections["school"].findOne({ where: { id: schoolId, isDeleted: false } })
    const parent = await collections["parent"].findOne({ where: { id: user, isDeleted: false } })
    const inviteSmsText = `
Hello {{username}}, 

You have been invited to join {{schoolName}} on ShulePlus, a Parent Teacher School Collaboration App for assignments and revision.

To get started, please login with OTP using this phone number and the following link: https://play.google.com/store/apps/details?id=com.shule.plusapp

Thanks, ShulePlus.`;

    const template = Handlebars.compile(inviteSmsText)
    const password = generatePassword()
    const hashedPassword = await argon2.hash(password);
    const phone = parent.phone;
    const smsTemplateData = {
      username: parent.name, phone_number: phone, schoolName: school.name
    }
    const message = template(smsTemplateData)

    try {
      await sms({ data: { phone, message } })
    } catch (e) {
      console.error("Error sending sms to " + phone + ": " + e)
      Bugsnag.notify(e, (report) => {
        report.metadata = {
          request: {
            phone,
            message
          }
        }
      })
    }
    await collections["parent"].update({ id: parent.id }).set({ password: hashedPassword });

    const id = new ObjectId().toHexString();
    const entry = Object.assign({ id, school: schoolId, user, message, phone, email: parent.email, isDeleted: false });

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
