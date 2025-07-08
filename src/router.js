require("dotenv").config();
import "graphql-import-node";
import "babel-polyfill";
import 'source-map-support/register'

import express from "express";
import { makeExecutableSchema } from "graphql-tools";
import graphqlHTTP from "express-graphql";
const { formatError, GraphQLError } = require('graphql')

import Joi from "joi"

import { importSchema } from 'graphql-import'
import { checkToken } from "./auth"
import resolvers from "./graphql/index";
import Bugsnag from "@bugsnag/js"

// <<< CHANGED: 1. Import the createLoaders function from your refactored resolver file.
// Please ensure this path is correct for your project structure.
import { createLoaders } from "./graphql/resolvers/Query/school"; 

const { BUGSNAG_API_KEY } = process.env

const validator = require('express-joi-validation').createValidator({})

const typeDefs = importSchema('./schema.graphql')
let schema = makeExecutableSchema({ typeDefs, resolvers });

const NotifyErrors = require('graphql-notify-errors')
const filter = err => !(err instanceof GraphQLError)
const options = {
  formatError,
  filter,
  notify: Bugsnag.notify
}
const notifyErrors = new NotifyErrors(options)

var router = express.Router()

export default (storage) => {
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

  // This variable is no longer needed here as it's defined inside the 'storage' export
  // var storage 

  router.use(
    "/graph",
    validator.headers(headerSchema),
    checkToken,
    async (req, res, next) => {
      const db = await storage;

      // <<< CHANGED: 2. Create a new set of loaders FOR THIS REQUEST.
      const loaders = createLoaders(db.collections);

      return graphqlHTTP({
        schema,
        graphiql: true,
        context: {
          auth: req.auth,
          db,
          // <<< CHANGED: 3. Add the loaders to the context object.
          loaders,
        },
        customFormatErrorFn: err => {
          console.error("GraphQL Error:", err);
          if (notifyErrors) {
            notifyErrors.formatError(err);
          }
          return formatError(err);
        }
      })(req, res, next);
    }
  );

  router.use(
    "/opengraph",
    async (req, res, next) => {
      const db = await storage;

      // <<< CHANGED: 2. Create loaders for the open endpoint as well.
      const loaders = createLoaders(db.collections);

      return graphqlHTTP({
        schema,
        graphiql: true,
        context: {
          auth: req.auth,
          db,
          open: true,
          // <<< CHANGED: 3. Add loaders to the context here too.
          loaders,
        },
        customFormatErrorFn: err => {
          console.error("GraphQL Error:", err);
          if (notifyErrors) {
            notifyErrors.formatError(err);
          }
          return formatError(err);
        }
      })(req, res, next);
    }
  );

  return router
};