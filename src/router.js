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

  var storage

  router.use(
    "/graph",
    validator.headers(headerSchema), // Keep validation
    checkToken, // Use updated middleware
    async (req, res, next) => {
      const db = await storage; // Assuming storage resolves to your DB connection/collections

      // Pass the validated req.auth object into the context
      return graphqlHTTP({
        schema,
        graphiql: true, // Keep for development
        context: {
          auth: req.auth, // Pass the decoded token payload here
          db
        },
        customFormatErrorFn: err => {
          console.error("GraphQL Error:", err); // Log the full error
          // Optionally notify Bugsnag or other services
          if (notifyErrors) {
            notifyErrors.formatError(err); // Use original error object
          }
          // Return a formatted error to the client
          return formatError(err);
        }
      })(req, res, next);
    }
  );

  router.use(
    "/opengraph",
    // validator.headers(headerSchema), // Keep validation
    // checkToken, // Use updated middleware
    async (req, res, next) => {
      const db = await storage; // Assuming storage resolves to your DB connection/collections

      // Pass the validated req.auth object into the context
      return graphqlHTTP({
        schema,
        graphiql: true, // Keep for development
        context: {
          auth: req.auth, // Pass the decoded token payload here
          db,
          open:true
        },
        customFormatErrorFn: err => {
          console.error("GraphQL Error:", err); // Log the full error
          // Optionally notify Bugsnag or other services
          if (notifyErrors) {
            notifyErrors.formatError(err); // Use original error object
          }
          // Return a formatted error to the client
          return formatError(err);
        }
      })(req, res, next);
    }
  );

  return router
};
