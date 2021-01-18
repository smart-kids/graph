import { ObjectId } from "mongodb";
import sms from "../../../../utils/sms";
const { name } = require("./about.js");


// fetch from db and use handlebars to template the student details
const messageMap = {
  CHECKEDON: `Our bus has confirmed that it dropped your child at his his ussual pickup/dropoff point. 

  Map link is _____
  
  Please use the Bethlehem app to raise any issues, view live data of the bus location as well as raise any issues to our support staff.
  
  we appreciate your commitment to time and safety.`,

  CHECKEDOFF: `Our bus has confirmed that our bus was unnable to pick your child at his/her ussual pick up point, please reach out to the school for explanation/corrections. 

  we appreciate appreciates your commitment to time and safety.`,

  TRIPSTARTED: `The school bus has left school and is on route to pick up your child, please ensure that he/she is ready to be picked up and his/her usual destination. 

  we appreciate appreciates your commitment to keep time.`
};

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

  const actions = schedule.actions ? JSON.parse(schedule.actions) : null;

  try {
    if (entry.type === "CHECKEDON")
      sms(
        { data: { phone: parent.phone, message: messageMap[entry.type] } },
        async () => {
          await collections["charge"].create({
            id: new ObjectId().toHexString(),
            school: trip.school,
            ammount: smsCost,
            reason: `sending message ${message}`,
            time: new Date(),
            isDeleted: false
          })
        }
      );

    if (entry.type === "CHECKEDOFF")
      sms(
        { data: { phone: parent.phone, message: messageMap[entry.type] } },
        async () => {
          await collections["charge"].create({
            id: new ObjectId().toHexString(),
            school: trip.school,
            ammount: smsCost,
            reason: `sending message ${message}`,
            time: new Date(),
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
