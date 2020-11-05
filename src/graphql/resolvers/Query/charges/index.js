const { name } = require("./about.js")

const list = async (root, args, { db: { collections } }) => {
  const entries = await collections[name].find({
    where: {
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
  const { id } = args[name];

  const entry = await collections[name].findOne({
    where: { id, isDeleted: false }
  });
  return entry;
};

const nested = {
  class:{
    students: async (root, args, { db: { collections }}) => {
      const entries = await collections["student"].find({ 
        where: { 
          class : root.id, isDeleted: false 
        }
      })

      return entries
    },
    teacher: async (root, args, { db: { collections }}) => {
      const entry = await collections["teacher"].findOne({ 
        where: { 
          id : root.teacher, isDeleted: false 
        }
      })

      return entry
    }
  }
}

export { list, single, listDeleted, nested };
