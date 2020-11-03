const { name } = require("./about.js")

const single = async (root, args, { auth, db: { collections } }) => {
  console.log("test",auth[Object.keys(auth)[0]])
  
  return auth
};

export { single };
