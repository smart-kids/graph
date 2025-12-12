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
    phone,
    createdAt: new Date().toDateString(),
    updatedAt: new Date().toDateString()
  }

  entry.createdAt = new Date().toDateString();
  entry.updatedAt = new Date().toDateString();

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

    entry.updatedAt = new Date();

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

    const message = `
   Hi ${driver.names}, to test the Shule+ app, 
   please open this link on your phone. It will guide you through joining the test and downloading the app: https://play.google.com/apps/testing/com.shule.plusapp
   
   For login, request for OTP using ${driver.phone}`;

    const template = Handlebars.compile(message)
    const phone = driver.phone;
    const smsTemplateData = {
      username: driver.names, phone_number: phone, email: driver.email
    }
    const smsMessage = template(smsTemplateData)

    sms({ data: { phone, message: smsMessage } },
      async (res) => {
        console.log(res)
        const { smsCost="0.6" } = res
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
    return {
      id: user,
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
