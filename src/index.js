require("dotenv").config();
import "graphql-import-node";
import "babel-polyfill";

import express from "express";
import { makeExecutableSchema } from "graphql-tools";
import graphqlHTTP from "express-graphql";

import Joi from "joi"

import { importSchema } from 'graphql-import'
import { checkToken } from "./auth"
import resolvers from "./graphql/index";

const validator = require('express-joi-validation').createValidator({})

const typeDefs = importSchema('./schema.graphql')
let schema = makeExecutableSchema({ typeDefs, resolvers });

var router = express.Router()

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
