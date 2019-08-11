import { list as companies, single as company } from "./companies";

export default {
  companies,
  company,
  hello: () => {
    let dummy = "test"

    dummy = dummy + "==="

    dummy = "hello"
    return dummy;
  }
};
