require("dotenv").config();
import "graphql-import-node";
import "babel-polyfill";

import express from "express";
import Joi from "joi"
import jwt from "jsonwebtoken"
import bodyParser from "body-parser"
import sms from "../utils/sms"

const validator = require('express-joi-validation').createValidator({})

const config = {
    secret: "privateKEY"
}

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



router.use(
    "/verifySMSauth",
    validator.body(Joi.object({
        user: Joi.string().required(),
        password: Joi.string().required()
    })),
    async (req, res) => {
        const { db: { collections } } = req.app.locals
        const { user, password } = req.body

        // check the token
        const data = await collections["OTP"].findOne({ password, used: false })

        if (data) {
            var token = jwt.sign(data, config.secret);
            return res.send({
                token,
                data
            })
        }

        return res.status(401).send({ message: "OTP not found, or already used" })
    }
);



router.use(
    "/login",
    validator.body(Joi.object({
        user: Joi.string().required()
    })),
    async (req, res) => {
        const { db: { collections } } = req.app.locals
        const { user } = req.body

        // check drivers numbers
        const driver = await collections["driver"].findOne({ username: user, isDeleted: false })

        // check parents list
        const parent = await collections["parent"].findOne({ phone: user, isDeleted: false })

        // check admins list
        const admin = await collections["admin"].findOne({ username: user, isDeleted: false })

        const returnAuth = () => {
            const password = makeid()
            // send sms to phone
            sms({ data: { password, phone: "+254711657108" } })

            collections["OTP"].create({
                user: {
                    driver,
                    parent,
                    admin
                },
                password
            })
        }

        if (driver) {
            returnAuth(driver)
        }

        if (parent) {
            returnAuth(parent)
        }

        if (admin) {
            returnAuth(admin)
        }

        return res.status(401).send({ message: "User not found, Please contact an administrator" })
    }
);

export {
    checkToken,
    router
};