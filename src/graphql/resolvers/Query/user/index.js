const { name } = require("./about.js")

const single = async (root, args, { auth, db: { collections } }) => {
  console.log(auth)
  return auth
};

export { single };
