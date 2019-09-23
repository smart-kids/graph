import admins from "./admins";
import routes from "./routes";
import drivers from "./drivers";
import buses from "./buses";
import students from "./students";
import parents from "./parents";
import schedules from "./schedules";
import events from "./event";

export default {
  admins,
  routes,
  drivers,
  buses,
  students,
  parents,
  schedules,
  events,
  hello() {
    return "hello mutation";
  }
};
