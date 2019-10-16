require("dotenv").config();
import "graphql-import-node";
import "babel-polyfill";

import express from "express";
import { makeExecutableSchema } from "graphql-tools";
import graphqlHTTP from "express-graphql";
import Joi from "joi"
import morgan from "morgan";

import { importSchema } from 'graphql-import'
import { checkToken } from "./auth"
import cors from "cors"
import resolvers from "./graphql/index";

const validator = require('express-joi-validation').createValidator({})

const typeDefs = importSchema('./schema.graphql')
let schema = makeExecutableSchema({ typeDefs, resolvers });

var router = express.Router()

const { NODE_ENV, DB_URL = 'db url here' } = process.env;

if (NODE_ENV !== "test") router.use(morgan("tiny"), cors({
  origin: ['development', "test"].includes(NODE_ENV) ? '*' : 'https://smart-kids-admin-staging.netlify.com',
  optionsSuccessStatus: 200
}));

router.get("/health", (req, res) => res.send());

const headerSchema = Joi.object({
  authorization: Joi.string().required()
})

router.use(
  "/graph",
  validator.headers(headerSchema),
  checkToken,
  (req, res, next) => {
    return graphqlHTTP({
      schema,
      graphiql: true,
      context: {
        auth: req.decoded,
        db: req.app.locals.db
      }
    })(req, res, next)
  }
);

export default router;
