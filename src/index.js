require("dotenv").config();
import "graphql-import-node";
import "babel-polyfill";
import 'source-map-support/register'

import express from "express";
import { makeExecutableSchema } from "graphql-tools";
import graphqlHTTP from "express-graphql";

import Joi from "joi"

import { importSchema } from 'graphql-import'
import { checkToken } from "./auth"
import resolvers from "./graphql/index";
import Bugsnag from "@bugsnag/js"

const { BUGSNAG_API_KEY } = process.env

const validator = require('express-joi-validation').createValidator({})

const typeDefs = importSchema('./schema.graphql')
let schema = makeExecutableSchema({ typeDefs, resolvers });

var router = express.Router()

if (BUGSNAG_API_KEY) {
  var BugsnagPluginExpress = require('@bugsnag/plugin-express')

  Bugsnag.start({
    apiKey: BUGSNAG_API_KEY,
    plugins: [BugsnagPluginExpress]
  })

  const { requestHandler: BugSnagrequestMiddleware, errorHandler: BugSnagErrorHandler } = Bugsnag.getPlugin('express')
  router.use(BugSnagrequestMiddleware, BugSnagErrorHandler);
}

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
      },
      formatError: (err) => {
        if (BUGSNAG_API_KEY)
          Bugsnag.notify(err)

        return (err)
      }
    })(req, res, next)
  }
);

export default router;
