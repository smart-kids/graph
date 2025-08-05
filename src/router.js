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
import { createLoaders as schoolLoaders } from "./graphql/resolvers/Query/school";
import { createLoaders as studentLoaders } from "./graphql/resolvers/Query/students"
import { createLoaders as gradesLoaders } from "./graphql/resolvers/Query/grades"
import { createLoaders as subjectsLoaders } from "./graphql/resolvers/Query/subjects"
import { createLoaders as topicsLoaders } from "./graphql/resolvers/Query/topics"
import { createLoaders as subtopicsLoaders } from "./graphql/resolvers/Query/subtopics"
import { createLoaders as questionsLoaders } from "./graphql/resolvers/Query/questions"
// import { createLoaders as answersLoaders } from "./graphql/resolvers/Query/answers"
import { createLoaders as optionsLoaders } from "./graphql/resolvers/Query/options"

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

  router.use(
    "/graph",
    validator.headers(headerSchema),
    checkToken,
    async (req, res, next) => {
      const db = await storage;

      const schoolLoaderSet = schoolLoaders(db.collections);
      const studentLoaderSet = studentLoaders(db.collections);
      const gradeLoaderSet = gradesLoaders(db.collections);
      const subjectLoaderSet = subjectsLoaders(db.collections);
      const topicLoaderSet = topicsLoaders(db.collections);
      const subtopicLoaderSet = subtopicsLoaders(db.collections);
      const questionLoaderSet = questionsLoaders(db.collections);
      const optionLoaderSet = optionsLoaders(db.collections);

      const allLoaders = {
        ...schoolLoaderSet,
        ...studentLoaderSet,
        ...gradeLoaderSet,
        ...subjectLoaderSet,
        ...topicLoaderSet,
        ...subtopicLoaderSet,
        ...questionLoaderSet,
        ...optionLoaderSet,
      };

      return graphqlHTTP({
        schema,
        graphiql: true,
        context: {
          auth: req.auth,
          db,
          loaders: allLoaders,
          params: req.body
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

      // <<< CORRECTED: Apply the same logic here for the open endpoint.
      const schoolLoaderSet = schoolLoaders(db.collections);
      const studentLoaderSet = studentLoaders(db.collections);
      const gradeLoaderSet = gradesLoaders(db.collections);
      const subjectLoaderSet = subjectsLoaders(db.collections);
      const topicLoaderSet = topicsLoaders(db.collections);
      const subtopicLoaderSet = subtopicsLoaders(db.collections);
      const questionLoaderSet = questionsLoaders(db.collections);
      const optionLoaderSet = optionsLoaders(db.collections);

      const allLoaders = {
        ...schoolLoaderSet,
        ...studentLoaderSet,
        ...gradeLoaderSet,
        ...subjectLoaderSet,
        ...topicLoaderSet,
        ...subtopicLoaderSet,
        ...questionLoaderSet,
        ...optionLoaderSet,
      };

      return graphqlHTTP({
        schema,
        graphiql: true,
        context: {
          auth: req.auth,
          db,
          open: true,
          loaders: allLoaders,
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