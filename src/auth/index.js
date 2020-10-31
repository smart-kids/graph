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
        sms({ data: { message: `Thank you for registering ${name} to shule plus. Please login to our app to start enjoying your first free month`, phone } }, console.log)

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

        // check drivers numbers
        const driver = await collections["driver"].findOne({ phone: user, isDeleted: false })

        // check parents list
        const parent = await collections["parent"].findOne({ phone: user, isDeleted: false })

        // check admins list
        const adminEmail = await collections["admin"].findOne({ username: user, isDeleted: false })
        const adminPhone = await collections["admin"].findOne({ phone: user, isDeleted: false })

        const returnAuth = async (userData) => {
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
            }

            if (password && userData.password) {

                // console.log((admin && admin.password || parent && parent.password || driver && driver.password), password)
                try {
                    if (await argon2.verify(userData.password || 'test', password)) {
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
                    sms({ data: { message: `${password} is your SmartKids login code. Don't reply to this message with your code.`, phone: (driver && driver.phone || parent && parent.phone) } }, console.log)

                await collections["otp"].create({
                    id: new ObjectId().toHexString(),
                    userId: user,
                    userType,
                    user: JSON.stringify(driver || parent || adminEmail || adminPhone),
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
            return returnAuth(driver)
        }

        if (parent) {
            userType = 'parent'
            return returnAuth(parent)
        }

        if (adminPhone || adminEmail) {
            userType = 'admin'
            return returnAuth(adminPhone || adminEmail)
        }

        return res.status(401).send({ message: "User not found, Please contact an administrator" })
    }
);

export {
    checkToken,
    router
};

// sms({ data: { password: makeid(), phone: "+254711657108" } }, console.log)