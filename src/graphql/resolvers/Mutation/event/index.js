import { ObjectId } from "mongodb";
import sms from "../../../../utils/sms";
import Handlebars from "handlebars"
import moment from "moment"
const { name } = require("./about.js");

const { UserError } = require("graphql-errors");

const create = async (data, { db: { collections } }) => {
  const id = new ObjectId().toHexString();
  const entry = Object.assign(data[name], { id, isDeleted: false });

  const student = await collections["student"].findOne({
    where: { id: entry.student, isDeleted: false }
  });

  const parent = await collections["parent"].findOne({
    where: { id: student.parent2, isDeleted: false }
  });

  const trip = await collections["trip"].findOne({
    where: { id: entry.trip, isDeleted: false }
  });

  const schedule = await collections["schedule"].findOne({
    where: { id: trip.schedule, isDeleted: false }
  });

  const school = await collections["school"].findOne({
    where: { id: trip.school, isDeleted: false }
  });

  const actions = schedule.actions ? JSON.parse(schedule.actions) : null;

  const time = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const templateData = {
    student_name: student.names,
    parent_name: parent.name,
    school_name: school.name, 
    time
  }

  const message = Handlebars.compile(schedule.message)(templateData) || "Schedule Message"

  console.log("Attemting to send sms" + JSON.stringify({ phone: parent.phone, message }))
  try {
    sms(
      { data: { phone: parent.phone, message } },
      async (res) => {
        const { smsCost } = res

        if (smsCost)
          await collections["charge"].create({
            id: new ObjectId().toHexString(),
            school: trip.school,
            ammount: smsCost,
            reason: `Sending message ${message}`,
            time,
            isDeleted: false
          })
      }
    );
  } catch (err) {
    console.error("Unnable to send sms", err);
  }

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

export default () => {
  return {
    create,
    update,
    archive,
    restore
  };
};