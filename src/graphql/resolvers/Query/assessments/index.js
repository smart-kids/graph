const { name } = require("./about.js")

const list = async (root, args, { db: { collections } }) => {
  const where = args.where || { isDeleted: false };
  if (where.isDeleted === undefined) where.isDeleted = false;
  
  const entries = await collections[name].find({ where });
  return entries;
};

const single = async (root, args, { db: { collections } }) => {
  const { id } = args;

  const entry = await collections[name].findOne({
    where: { id, isDeleted: false }
  });
  return entry;
};

const nested = {
  assessment: {
    async student(root, args, { db: { collections } }) {
      return await collections["student"].findOne({
        where: { id: root.student }
      });
    },
    async term(root, args, { db: { collections } }) {
      return await collections["term"].findOne({
        where: { id: root.term }
      });
    },
    async subject(root, args, { db: { collections } }) {
      return await collections["subject"].findOne({
        where: { id: root.subject }
      });
    },
    async assessmentType(root, args, { db: { collections } }) {
      return await collections["assessmentTypes"].findOne({
        where: { id: root.assessmentType }
      });
    },
    async teacher(root, args, { db: { collections } }) {
      return await collections["teacher"].findOne({
        where: { id: root.teacher }
      });
    },
    async school(root, args, { db: { collections } }) {
      return await collections["school"].findOne({
        where: { id: root.school }
      });
    },
  }
}

export { list, single, nested };
