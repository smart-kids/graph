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
    "/login",
    validator.body(Joi.object({
        user: Joi.string().required(),
        password: Joi.string()
    })),
    async (req, res) => {
        const { db: { collections } } = req.app.locals
        const { user, password } = req.body

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
        const admin = await collections["admin"].findOne({ username: user, isDeleted: false })

        const returnAuth = async () => {
            if (password) {
                console.log({
                    driver,
                    parent,
                    admin
                })
                // console.log((admin && admin.password || parent && parent.password || driver && driver.password), password)
                try {
                    if (await argon2.verify((admin && admin.password || parent && parent.password || driver && driver.password) || 'test', password)) {
                        // password match
                        var token = jwt.sign(driver || parent || admin, config.secret);
                        return res.send({
                            token,
                            data: driver || parent || admin
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
                    sms({ data: { password, phone: (driver.phone || parent.phone) } }, console.log)

                await collections["otp"].create({
                    id: new ObjectId().toHexString(),
                    userId: user,
                    userType,
                    user: JSON.stringify(driver || parent || admin),
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

        if (admin) {
            userType = 'admin'
            return returnAuth(admin)
        }

        return res.status(401).send({ message: "User not found, Please contact an administrator" })
    }
);

export {
    checkToken,
    router
};

// sms({ data: { password: makeid(), phone: "+254711657108" } }, console.log)