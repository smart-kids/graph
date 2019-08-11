import { list as companies, single as company } from "./companies";
import { list as securities, single as security } from "./companies/securities";
import {
  list as expenses,
  single as expense
} from "./companies/securities/expenses";

export default {
  companies,
  company,
  securities,
  security,
  expenses,
  expense,
  hello: () => "test"
};
