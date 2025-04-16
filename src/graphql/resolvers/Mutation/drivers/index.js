import { ObjectId } from "mongodb"
import argon2 from "argon2"
const { name } = require("./about.js")
import Handlebars from "handlebars"
import sms from "../../../../utils/sms"
const prepareUser = require("../../../../utils/prepapreUser")

const { UserError } = require("graphql-errors");

function makeid() {
  var text = "";
  var possible = "123456789";

  for (var i = 0; i < 5; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

const create = async (data, { db: { collections } }) => {
  const id = new ObjectId().toHexString();
  const roleId = new ObjectId().toHexString();
  const userId = new ObjectId().toHexString();


  const entry = Object.assign(data[name], { id, userId, isDeleted: false });
  const { school } = entry

  const roleUser = {
    id: roleId,
    role: 2, // driver
    user: userId,
    school,
    isDeleted: false
  }

  await collections.user_role.create(roleUser);

  const { names, email, phone } = data[name]
  const userEntry = {
    id:userId,
    names,
    email,
    phone
  }

  try {
    await collections[name].create(entry);
    await collections.users.create(userEntry);

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

const transfer = async (data, { db: { collections } }) => {
  const { school, driver } = data[name]
  try {
    await collections[name].update({ id: driver }).set({ school });

    return {
      id: driver
    };
  } catch (err) {
    throw new UserError(err.details);
  }
};

const invite = async (data, { db: { collections } }) => {
  const { school, user } = data[name]

  try {
    const driver = await collections["driver"].findOne({ where: { id: user, isDeleted: false } })

    const inviteSmsText = `
    Hello {{username}}, 

You have been invited to ShulePlus.
    
access app here: https://play.google.com/store/apps/details?id=com.shule.plusapp
    
use the following details to login
    
phone number: {{phone_number}}
password: {{password}}`;

    const template = Handlebars.compile(inviteSmsText)
    const password = makeid()
    const hashedPassword = await argon2.hash(password);
    const phone = driver.phone;
    const smsTemplateData = {
      username: driver.username, phone_number: phone, password
    }
    const message = template(smsTemplateData)

    sms({ data: { phone, message } },
      async (res) => {
        console.log(res)
        // const { smsCost } = res
        await collections["charge"].create({
          id: new ObjectId().toHexString(),
          school,
          // ammount: smsCost,
          reason: `Sending message '${message}'`,
          time: new Date(),
          isDeleted: false
        })
      }
    )
    await collections["driver"].update({ id: driver.id }).set({ password: hashedPassword });

    const id = new ObjectId().toHexString();
    const entry = Object.assign({ id, school, user, message, phone, email: driver.email, isDeleted: false });

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
    transfer,
  };
};
