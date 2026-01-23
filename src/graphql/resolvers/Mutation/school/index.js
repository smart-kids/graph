import { ObjectId } from "mongodb"
const { name } = require("./about.js")
import argon2 from "argon2"
import Handlebars from "handlebars"
import sms from "../../../../utils/sms"
import generatePassword from "../../../../utils/generatePassword"

const { UserError } = require("graphql-errors");

const default_roles_per_school = [
  "Admin",
  "Driver",
  // "Student",
  // "Parent",
]

const create = async (data, { db: { collections } }) => {
  const entry = data[name];
  const { phone, email, names } = entry;

  const existing = await collections[name].findOne({ phone, isDeleted: false });
  if (existing) {
    throw new UserError(`A ${name} with the phone number ${phone} already exists.`);
  }

  const newId = new ObjectId().toHexString();
  const password = generatePassword();
  const hashedPassword = await argon2.hash(password);

  let { gradeOrder, termOrder } = entry;
  entry.gradeOrder = gradeOrder ? gradeOrder.join(",") : "";
  entry.termOrder = termOrder ? termOrder.join(",") : "";

  const inviteSmsText = `Hello {{username}}, 

  You have been invited to join {{team_name}} on ShulePlus.

  access admin here https://cloud.shuleplus.co.ke

  use 

  phone number: {{phone_number}}
  password: {{password}}`;

  try {
    const createdSchool = await collections[name].create({
      ...entry,
      id: newId,
      isDeleted: false,
      inviteSmsText,
    }).fetch();

    // const roles = await Promise.all(
    //   // default_roles_per_school.map((roleName) =>
    //   //   collections["roles"].create({
    //   //     id: new ObjectId().toHexString(),
    //   //     name: roleName,
    //   //     school: createdSchool.id,
    //   //     isDeleted: false,
    //   //   }).fetch()
    //   // )
    // );

    // const adminRole = roles.find((r) => r.name === "Admin");

    const adminUser = await collections["users"].create({
      id: new ObjectId().toHexString(),
      names: names || entry.name,
      email,
      phone,
      password: hashedPassword,
      school: createdSchool.id,
      // lastLogin: new Date(),
      role: "Admin", //adminRole //? adminRole.id : null,
      isDeleted: false,
    }).fetch();

    const template = Handlebars.compile(inviteSmsText);
    const message = template({
      username: adminUser.names,
      team_name: createdSchool.name,
      phone_number: phone,
      password: password,
    });

    try {
      await sms.send(phone, message);
    } catch (smsErr) {
      console.error("[SMS Error]", smsErr);
    }

    return createdSchool;
  } catch (err) {
    console.error(`[${name} Create Error]`, err);
    throw new UserError(err.message || `An unexpected error occurred while creating the ${name}.`);
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
Hello {{username}}, 

You are being invited to join ShulePlus as an administrator for {{schoolName}}.

access your portal here https://cloud.shuleplus.co.ke

and download mobile app here https://play.google.com/store/apps/details?id=com.shule.plusapp

use the following details to login to the app
phone number: {{phone}}`

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
        const { smsCost = 0 } = res
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
    await collections["invitation_passwords"].insert({ id: admin.id }, { upsert: true }).set({ password: hashedPassword });

    const invitationId = new ObjectId().toHexString();
    const entry = Object.assign({ id: invitationId, school: schoolId, user: admin.id, message, phone, email: admin.email, isDeleted: false });

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
