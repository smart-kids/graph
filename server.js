require("dotenv").config();
import "graphql-import-node";

const express = require("express");
import { graphql } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import graphqlHTTP from "express-graphql"

import typeDefs from "./graphql/base";

let schema = makeExecutableSchema({ typeDefs });

const app = express();
const port = 3000;

const { NODE_ENV } = process.env;

app.get("/health", (req, res) => res.send());

app.use(
  "/graph",
  graphqlHTTP({
    schema,
    graphiql: true
  })
);

if (NODE_ENV !== "test")
  app.listen(port, () =>
    console.log(`Unit Trust running on port  ${port}! ${NODE_ENV}`)
  );

export default app;
