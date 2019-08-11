import { list as companies, single as company } from "./companies";
import { list as securities, single as security } from "./companies/securities";
import {
  list as expenses,
  single as expense
} from "./companies/securities/expenses";
import { list as agents, single as agent } from "./companies/agents";
import { list as members, single as member } from "./companies/members";

export default {
  companies,
  company,
  securities,
  security,
  expenses,
  expense,
  agents,
  agent,
  members,
  member,
  hello: () => "test"
};
