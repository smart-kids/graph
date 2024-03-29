import team_members from "../../Mutation/team_members/index.js";

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
  team: {
    async school(root, args, { db: { collections } }) {
      const entry = await collections["school"].findOne({
        where: { id: root.school, isDeleted: false }
      });
      return entry;
    },
    async members(root, args, { db: { collections } }) {
      const teachers = []
      const team_members = await collections["team_member"].find({
        where: { team: root.id, isDeleted: false }
      });

      await Promise.all(team_members.map(async team_member=>{
        const teacher = await collections["teacher"].find({
          where: { id: team_member.user, isDeleted: false }
        });
        teachers.push(...teacher)
      }))
      return teachers
    }
  },
}

export { list, single, listDeleted, nested };
