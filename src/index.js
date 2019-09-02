require("dotenv").config();
import "graphql-import-node";
import "babel-polyfill";

import express from "express";
import { makeExecutableSchema } from "graphql-tools";
import graphqlHTTP from "express-graphql";
import morgan from "morgan";
import Waterline from "waterline"
import sailsDiskAdapter from "sails-disk";
import { importSchema } from 'graphql-import'

import admins from "./graphql/resolvers/Mutation/admins/model";
import routes from "./graphql/resolvers/Mutation/routes/model";
import drivers from "./graphql/resolvers/Mutation/drivers/model";
import buses from "./graphql/resolvers/Mutation/buses/model";
import students from "./graphql/resolvers/Mutation/students/model";
import parents from "./graphql/resolvers/Mutation/parents/model";
import resolvers from "./graphql/index";

const typeDefs = importSchema('./schema.graphql')
let schema = makeExecutableSchema({ typeDefs, resolvers });

// const router = express();
var router = express.Router()

const { NODE_ENV, PORT = 3000 } = process.env;

if (NODE_ENV !== "test") router.use(morgan("tiny"));

router.get("/health", (req, res) => res.send());

var config = {
  adapters: {
    disk: sailsDiskAdapter,
    filePath: '/tmp'
  },
  datastores: {
    default: {
      adapter: "disk"
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
