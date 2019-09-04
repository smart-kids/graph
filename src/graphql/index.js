import { Query, nested as nestedQueries } from "./resolvers/Query";
import Mutation from "./resolvers/Mutation";

const root = {
  Query,
  Mutation
}

Object.assign(root, nestedQueries)

export default root;
