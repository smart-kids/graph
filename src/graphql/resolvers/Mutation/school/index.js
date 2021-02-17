import { ObjectId } from "mongodb"
const { name } = require("./about.js")
import argon2 from "argon2"
import Handlebars from "handlebars"
import sms from "../../../../utils/sms"
import generatePassword from "../../../../utils/generatePassword"

const { UserError } = require("graphql-errors");

const create = async (data, { db: { collections } }) => {
  const { phone } = data[name];
  try {
    const phoneTaken = await collections[name].find({ phone, isDeleted: false });
    if (phoneTaken.length) {
      return {
        error: `A school with the phone number ${phone} already exists!.`,
      };
    }
  } catch (err) {
  }

  const id = new ObjectId().toHexString();
  const inviteSmsText = `Hello {{username}}, 

You have been invited to join {{team_name}} on ShulePlus.

access admin here https://cloud.shuleplus.co.ke

use 

phone number: {{phone_number}}
password: {{password}}`;

  let { gradeOrder } = data[name];
  let { termOrder } = data[name];
  gradeOrder = gradeOrder ? gradeOrder.join(",") : "";
  termOrder = termOrder ? termOrder.join(",") : "";

  const entry = Object.assign(data[name], { inviteSmsText, gradeOrder, termOrder, id, isDeleted: false });

  try {
    const school = await collections[name].create(entry);
    const { email, phone } = data[name];
    const adminId = new ObjectId().toHexString();
    await collections["admin"].create({
      id: adminId,
      username: email,
      email: email,
      phone: phone,
      school: id,
    });

    return entry;
  } catch (err) {
    console.log(err)
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

const invite = async (data, { db: { collections } }) => {
  try {
    const { id: schoolId, name: schoolName } = data[name];
    console.log({ data })

    const admins = await collections["admin"].find({ where: { school: schoolId, isDeleted: false } });

    if (admins.length > 1) {
      console.log("found multiple admins for ", schoolId, data)
    }

    var admin = admins[0]

    const inviteSmsText = `
Hello {{schoolName}} administrator, 

You are being invited to join ShulePlus as an administrator for {{schoolName}} with the email {{username}}.

access your portal here https://cloud.shuleplus.co.ke

and download mobile app here https://play.google.com/store/apps/details?id=com.shule.plus

use the following details to login and start enjoying your first free month:

open the app or admin and select "i already have an account", 

phone number: {{phone}}
password: {{password}}`;

    const template = Handlebars.compile(inviteSmsText);
    const password = generatePassword();
    const hashedPassword = await argon2.hash(password);
    const { phone, username } = admin;

    const message = template({
      username,
      phone,
      password,
      schoolName
    })

    console.log("sending message", message)
    sms({ data: { phone, message } },
      async (res) => {
        const { smsCost } = res
        await collections["charge"].create({
          id: new ObjectId().toHexString(),
          school: schoolId,
          ammount: smsCost,
          reason: `Sending message '${message}'`,
          time: new Date(),
          isDeleted: false
        })
      }
    )
    await collections["admin"].update({ id: admin.id }).set({ password: hashedPassword });

    const invitationId = new ObjectId().toHexString();
    const entry = Object.assign({ id, school: schoolId, user: admin.id, message, phone, email: admin.email, isDeleted: false });

    await collections["invitation"].create(entry);
    return {
      id: invitationId,
      message,
      phone
    };
  } catch (err) {
    console.log(err)
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
