import admins from "./admins";
import routes from "./routes";
import drivers from "./drivers";
import buses from "./buses";
import students from "./students";
import parents from "./parents";
import schedules from "./schedules";
import events from "./event";
import scheduleEvents from './schedule-events'

export default {
  admins,
  routes,
  drivers,
  buses,
  students,
  parents,
  schedules,
  events,
  scheduleEvents,
  hello() {
    return "hello mutation";
  }
};
