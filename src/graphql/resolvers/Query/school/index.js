import payments from "../../Mutation/payments/index.js";
import schedules from "../../Mutation/schedules/index.js";
import { sum, subtract } from "mathjs"

const { name } = require("./about.js")

const list = async (root, args, { auth, db: { collections } }) => {

  const entries = await collections[name].find({
    where: {
      id: auth.admin.school,
      isDeleted: false
    }
  });

  return entries;
};

const listDeleted = async (root, args, { db: { collections } }) => {
  const entries = await collections[name].find({
    where: {
      isDeleted: true
    }
  });
  return entries;
};

const single = async (root, args, { db: { collections } }) => {
  const entries = await collections[name].find({
    where: {
      isDeleted: false
    }
  });
  return entries[0];
};

const nested = {
  school: {
    async financial(root, args, { db: { collections } }) {
      const payments = await collections["payment"].find({
        where: { school: root.id, isDeleted: false }
      });

      const charges = await collections["charge"].find({
        where: { school: root.id, isDeleted: false }
      });

      const paymentsSum = sum(payments.map(p => p.ammount))
      const chargesSum = sum(charges.map(p => p.ammount))

      const balance = subtract(paymentsSum, chargesSum)

      return {
        balance
      }
    },
    async students(root, args, { db: { collections } }) {
      const entries = await collections["student"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async buses(root, args, { db: { collections } }) {
      const entries = await collections["bus"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async charges(root, args, { db: { collections } }) {
      const entries = await collections["charge"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async payments(root, args, { db: { collections } }) {
      const entries = await collections["payment"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async teachers(root, args, { db: { collections } }) {
      const entries = await collections["teacher"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async classes(root, args, { db: { collections } }) {
      const entries = await collections["class"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async complaints(root, args, { db: { collections } }) {
      const entries = await collections["complaint"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async drivers(root, args, { db: { collections } }) {
      const entries = await collections["driver"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async parents(root, args, { db: { collections } }) {
      const entries = await collections["parent"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async routes(root, args, { db: { collections } }) {
      const entries = await collections["route"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async trips(root, args, { db: { collections } }) {
      const entries = await collections["trip"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async schedules(root, args, { db: { collections } }) {
      const entries = await collections["schedule"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async grades(root, args, { db: { collections } }) {
      const entries = await collections["grade"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    },
    async terms(root, args, { db: { collections } }) {
      const entries = await collections["term"].find({
        where: { school: root.id, isDeleted: false }
      });
      return entries;
    }
  }
};

export { list, single, listDeleted, nested };
