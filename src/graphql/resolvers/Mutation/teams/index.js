import { ObjectId } from "mongodb"
import argon2 from "argon2"
const { name } = require("./about.js")
import Handlebars from "handlebars"
import sms from "../../../../utils/sms"

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

const invite = async (data, { db: { collections } }) => {
  const { school, user } = data[name]

  try {
    const schoolObj = await collections["school"].findOne({ where: { id: school, isDeleted: false } })
    const userObj = await collections["teacher"].findOne({ where: { id: user, isDeleted: false } })
    const teamMember = await collections["team_member"].find({ where: { user: user, isDeleted: false } })
    const teamObj = await collections["team"].findOne({ where: { id: teamMember[0] ? teamMember[0].team : "", isDeleted: false } })

    // const template = Handlebars.compile(schoolObj.inviteSmsText)
    const inviteSmsText = `
Hello {{username}}, 

You have been invited {{#if team_name}} to join {{team_name}} on {{else}} to {{/if}}ShulePlus.

access admin here https://cloud.shuleplus.co.ke

use 

phone number: {{phone_number}}
password: {{password}}`;

    const template = Handlebars.compile(inviteSmsText)
    const password = makeid()
    const passwordHash = await argon2.hash(password);
    const phone = userObj.phone;
    const smsTemplateData = {
      username: userObj.name, phone_number: phone, team_name: teamObj ? teamObj.name : null, password
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
    await collections["teacher"].update({ id: userObj.id }).set({ password: passwordHash });

    const id = new ObjectId().toHexString();
    const entry = Object.assign({ id, school, user, message, phone, emaili: userObj.email, sDeleted: false });

    collections["invitation"].create(entry);
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
    invite,
  };
};
