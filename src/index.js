require("dotenv").config();
import "graphql-import-node";
import "babel-polyfill";

const express = require("express");
import { graphql } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import graphqlHTTP from "express-graphql";
import morgan from "morgan";
var Waterline = require("waterline");
import sailsDiskAdapter from "sails-disk";

import companies from "./graphql/resolvers/Mutation/companies/model";
import configurations from "./graphql/resolvers/Mutation/companies/configurations/model";
import securities from "./graphql/resolvers/Mutation/companies/securities/model";
import securityExpenses from "./graphql/resolvers/Mutation/companies/securities/expenses/model";
import agents from "./graphql/resolvers/Mutation/companies/agents/model";
import member from "./graphql/resolvers/Mutation/companies/members/model";

import typeDefs from "./graphql/typeDefs";
import resolvers from "./graphql/index";

let schema = makeExecutableSchema({ typeDefs, resolvers });

const app = express();
const port = 3000;

const { NODE_ENV } = process.env;

if (NODE_ENV !== "test") app.use(morgan("tiny"));

app.get("/health", (req, res) => res.send());

var config = {
  adapters: {
    disk: sailsDiskAdapter
  },
  datastores: {
    default: {
      adapter: "disk"
    }
  }
};

var waterline = new Waterline();

waterline.registerModel(companies);
waterline.registerModel(configurations);
waterline.registerModel(securities);
waterline.registerModel(securityExpenses);
waterline.registerModel(agents);
waterline.registerModel(member);

waterline.initialize(config, (err, db) => {
  if (err) {
    throw err;
  }

  app.use(
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

if (NODE_ENV !== "test")
  app.listen(port, () =>
    console.log(`Unit Trust running on port  ${port}! ${NODE_ENV}`)
  );

export default app;
