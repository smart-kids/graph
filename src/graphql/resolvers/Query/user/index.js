const { name } = require("./about.js")

const single = async (root, args, { auth, db: { collections } }) => {
  return {
    id: auth.id,
    name: auth.names,
    email: auth.email,
    phone: auth.phone,
    userType: auth.userType
  }
}

export { single };
