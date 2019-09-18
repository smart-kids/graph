require("dotenv").config();
import "graphql-import-node";
import "babel-polyfill";

import express from "express";
import { makeExecutableSchema } from "graphql-tools";
import graphqlHTTP from "express-graphql";
import morgan from "morgan";
import Waterline from "waterline"
import DiskAdapter from "sails-disk";
import MongoAdapter from "sails-mongo";
import PostgresAdapter from "sails-postgresql"
import { importSchema } from 'graphql-import'
import cors from "cors"

import admins from "./graphql/resolvers/Mutation/admins/model";
import routes from "./graphql/resolvers/Mutation/routes/model";
import drivers from "./graphql/resolvers/Mutation/drivers/model";
import buses from "./graphql/resolvers/Mutation/buses/model";
import students from "./graphql/resolvers/Mutation/students/model";
import parents from "./graphql/resolvers/Mutation/parents/model";
import schedule from "./graphql/resolvers/Mutation/schedules/model";

import resolvers from "./graphql/index";

const typeDefs = importSchema('./schema.graphql')
let schema = makeExecutableSchema({ typeDefs, resolvers });

// const router = express();
var router = express.Router()

const { NODE_ENV, DB_URL = 'db url here' } = process.env;

if (NODE_ENV !== "test") router.use(morgan("tiny"), cors({
  origin: ['development', "test"].includes(NODE_ENV) ? '*' : 'https://smart-kids-admin-staging.netlify.com',
  optionsSuccessStatus: 200
}));

router.get("/health", (req, res) => res.send());

var config = {
  adapters: {
    mongo: MongoAdapter,
    disk: DiskAdapter,
  },
  datastores: {
    default: !['development', "test"].includes(NODE_ENV) ? {
      adapter: 'mongo',
      url: DB_URL
    } : {
        adapter: "disk",
        // filePath: '/tmp'
      }
  }
};

var waterline = new Waterline();

waterline.registerModel(admins);
waterline.registerModel(routes);
waterline.registerModel(drivers);
waterline.registerModel(buses);
waterline.registerModel(students);
waterline.registerModel(parents);
waterline.registerModel(schedule);

waterline.initialize(config, (err, db) => {
  if (err) {
    throw err;
  }

  router.use(
    "/graph",
    graphqlHTTP({
      schema,
      graphiql: true,
      context: {
        db
      }
    })
  );
});

export default router;
