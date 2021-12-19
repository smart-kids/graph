require("dotenv").config();
import "graphql-import-node";
import "babel-polyfill";

import { ObjectId } from "mongodb"
import express from "express";
import Joi from "joi"
import jwt from "jsonwebtoken"
import bodyParser from "body-parser"
import argon2 from "argon2"
import sms from "../utils/sms"


const validator = require('express-joi-validation').createValidator({})

const config = {
    secret: "privateKEY"
}

const { NODE_ENV = 'development', SUPER_ADMIN_PASSWORD = '00000' } = process.env;

let checkToken = (req, res, next) => {
    let token = req.headers['x-access-token'] || req.headers['authorization']; // Express headers are auto converted to lowercase
    if (token.startsWith('Bearer ')) {
        // Remove Bearer from string
        token = token.slice(7, token.length);
    }

    jwt.verify(token, config.secret, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: 'Token is not valid'
            });
        } else {
            req.decoded = decoded;
            next();
        }
    });

};

var router = express.Router()

router.use(bodyParser.urlencoded({ extended: false }))
router.use(bodyParser.json())

router.get("/health", (req, res) => res.send());

router.post(
    "/verify/sms",
    validator.body(Joi.object({
        user: Joi.string().required(),
        password: Joi.string().required()
    })),
    async (req, res) => {
        const { db: { collections } } = req.app.locals
        const { user, password } = req.body

        // check the token
        const [data] = await collections["otp"].find({
            userId: user,
            password,
            used: false
        })

        if (data) {
            collections["otp"].update({ id: data.id }).set({
                used: true
            })

            data.user = JSON.parse(data.user)
            data.password = undefined
            data.used = undefined

            if (data) {
                var token = jwt.sign(data, config.secret);
                return res.send({
                    token,
                    data
                })
            }
        }

        return res.status(401).send({ message: "OTP not found, or already used" })
    }
);


function makeid() {
    var text = "";
    var possible = "123456789";

    for (var i = 0; i < 5; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

router.post(
    "/super",
    validator.body(Joi.object({
        user: Joi.string().required(),
        password: Joi.string().required()
    })),
    async (req, res) => {
        const { user, password } = req.body

        const data = {
            admin: {
                user: 'Super Admin'
            }
        }

        if (user === 'sAdmin' && password === SUPER_ADMIN_PASSWORD) {
            var token = jwt.sign(data, config.secret);
            return res.send({
                token,
                data
            })
        }

        res.status(401).send()
    }
);


router.post(
    "/register",
    validator.body(Joi.object({
        name: Joi.string().required(),
        phone: Joi.string(),
        email: Joi.string(),
        address: Joi.string()
    })),
    async (req, res) => {
        // create a school object
        const { db: { collections } } = req.app.locals
        const { name, phone, email, address } = req.body

        const schoolId = new ObjectId().toHexString();
        await collections["school"].create({
            id: schoolId,
            name,
            phone,
            email,
            address
        })

        // create a use who is the admin with the phone number
        const adminId = new ObjectId().toHexString();
        await collections["admin"].create({
            id: adminId,
            username: email,
            email,
            phone,
            school: schoolId
        })

        // send an sms with welcome and link to download the app
        sms({
            school: schoolId,
            data: { message: `Thank you for registering ${name} to ShulePlus. Please login to our app to start enjoying your first free month`, phone }
        }, console.log)

        const data = {
            admin: {
                school: schoolId,
                user: email
            }
        }

        var token = jwt.sign(data, config.secret);
        return res.send({
            token,
            data
        })
        //TODO send an email with the welcome page, app and admin login

    })

router.post(
    "/login",
    validator.body(Joi.object({
        user: Joi.string().required(),
        password: Joi.string()
    })),
    async (req, res) => {
        const { db: { collections } } = req.app.locals
        const { user, password } = req.body

        console.log("Attemting to authenticate", user)

        let userType;

        if (user === 'sAdmin' && password === SUPER_ADMIN_PASSWORD) {
            const data = {
                admin: {
                    user: 'Super Admin'
                }
            }

            var token = jwt.sign(data, config.secret);
            return res.send({
                token,
                data
            })
        }
        console.log("user is not a super admin", user)

        // check drivers numbers
        const [driver] = await collections["driver"].find({ phone: user, isDeleted: false })

        if (!driver)
            console.log("user is not a driver", user)

        // check parents list
        const [parent] = await collections["parent"].find({ phone: user, isDeleted: false })

        if (!parent)
            console.log("user is not a parent", user)

        // check teacher list
        const [teacher] = await collections["teacher"].find({ phone: user, isDeleted: false })

        if (!teacher)
            console.log("user is not a teacher", user)

        // check admins list
        const [adminEmail] = await collections["admin"].find({ username: user, isDeleted: false })
        const [adminPhone] = await collections["admin"].find({ phone: user, isDeleted: false })

        if (adminEmail || adminPhone)
            console.log("user is on admins lists", { adminEmail, adminPhone })

        const returnAuth = async (userData, role) => {
            const { db: { collections } } = req.app.locals
            const { user, password } = req.body

            console.log("checking for passwords in otp list", { adminEmail, adminPhone })

            // check the token
            const [data] = await collections["otp"].find({
                userId: user,
                password,
                used: false
            })

            if (data) {
                collections["otp"].update({ id: data.id }).set({
                    used: true
                })

                console.log("User data", userData);

                // data.user = JSON.parse(data.user) may contain stale user data without the updated google id and email after google auth authentication.
                userData.password = undefined
                data.user = userData
                data.password = undefined
                data.used = undefined

                var token = jwt.sign(data, config.secret);
                return res.send({
                    token,
                    data
                })

            } else {
                console.log('could not find user in OTP', {
                    userId: user,
                    password,
                    used: false
                })
            }

            if (password && !userData.password) {
                const [data] = await collections["otp"].find({
                    userId: user,
                    password,
                    used: false
                })

                if (data) {
                    collections["otp"].update({ id: data.id }).set({
                        used: true
                    })

                    data.user = JSON.parse(data.user)
                    data.password = undefined
                    data.used = undefined

                    if (data) {
                        var token = jwt.sign(data, config.secret);
                        return res.send({
                            token,
                            data
                        })
                    }
                }
                // password did not match
                return res.status(401).send({ message: "Passwords did not match" })
            } else {
                console.log("no password was provided", { password, userData })
            }

            if (password && userData.password) {
                // console.log((admin && admin.password || parent && parent.password || driver && driver.password), password)
                try {
                    // fill this with other passwords
                    const passwords = [userData.password, "password test"]
                    let foundPassword = false

                    passwords.forEach(async password => {
                        try {
                            await argon2.verify(userData.password || 'test', password)
                            foundPassword = true
                        } catch (err) {
                            console.log("pass ", passwords.indexOf(password), "is not valid")
                        }
                    })

                    if (foundPassword) {
                        // password match
                        let data = {
                            user: userData,
                            userType,
                            userId: user
                        }

                        var token = jwt.sign(data, config.secret);

                        return res.send({
                            token,
                            data
                        })
                    } else {
                        const [data] = await collections["otp"].find({
                            userId: user,
                            password,
                            used: false
                        })

                        if (data) {
                            data.user = JSON.parse(data.user)
                            data.password = undefined
                            data.used = undefined

                            if (data) {
                                var token = jwt.sign(data, config.secret);
                                return res.send({
                                    token,
                                    data
                                })
                            }
                        }
                        // password did not match
                        return res.status(401).send({ message: "Passwords did not match" })
                    }
                } catch (err) {
                    // internal failure
                    console.log(err)
                    return res.status(401).send({ message: "Internal failure" })
                }
            } else {
                const password = ['development', "test"].includes(NODE_ENV) ? '0000' : makeid()
                // send sms to phone
                if (!['development', "test"].includes(NODE_ENV))
                    sms({
                        // school: schoolId,
                        data: { message: `${password} is your ShulePlus login code. Don't reply to this message with your code.`, phone: (driver && driver.phone || parent && parent.phone || userData.phone) }
                    }, console.log)

                await collections["otp"].create({
                    id: new ObjectId().toHexString(),
                    userId: user,
                    userType,
                    user: JSON.stringify(driver || parent || teacher || adminEmail || adminPhone),
                    password
                })

                return res.send({
                    success: true,
                    otp: true
                })
            }
        }

        if (driver) {
            userType = 'driver'
            return returnAuth(driver, userType)
        }

        if (parent) {
            userType = 'parent'
            return returnAuth(parent, userType)
        }

        if (teacher) {
            userType = 'teacher'
            return returnAuth(teacher, userType)
        }

        if (adminPhone || adminEmail) {
            userType = 'admin'
            return returnAuth(adminPhone || adminEmail, userType)
        }

        return res.status(401).send({ message: "User not found, Please contact an administrator" })
    }
);

export {
    checkToken,
    router
};

// const schoolId = "12345"
// const message = "1234"

// sms({ schoolId, data: { password: makeid(), phone: "+254711657108", message } }, async({
//     code,
//     messageID,
//     status,
//     smsCost,
//     smsCount
// }) => {
//     await collections["charges"].create({
//         id: new ObjectId().toHexString(),
//         school: schoolId,
//         ammount: smsCost,
//         userId: user,
//         reason: `sending message ${message}`,
//         time: new Date(),
//         isDeleted:false
//     })

//     // id: { type: "string", required: true },
//     // school: { type: "string", required: true },
//     // ammount: { type: "string", required: true },
//     // reason: { type: "string", required: true },
//     // time: { type: "string", required: true },
//     // isDeleted: { type: "boolean", defaultsTo: false }


//     console.log({
//         schoolId,
//         code,
//         messageID,
//         status,
//         smsCost,
//         smsCount
//     })
// })