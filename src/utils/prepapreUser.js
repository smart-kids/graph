import jwt from "jsonwebtoken"
import argon2 from "argon2"

const func = async (user) => {
    const { ENCRYPTION_TOKEN="privateKEY" } = process.env;

    user.password =  await argon2.hash(user.password)
    
    return user;
}

module.exports = func