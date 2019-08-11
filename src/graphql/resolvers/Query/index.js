import { list as companies, single as company } from "./companies";
import { list as securities, single as security } from "./companies/securities";

export default {
  companies,
  company,
  securities,
  security,
  hello: () => "test"
};
