import admins from "./admins";
import routes from "./routes";
import drivers from "./drivers";
import buses from "./buses";
import students from "./students";
import parents from "./parents";
import schedules from "./schedules";
import events from "./event";
import trips from "./trip";
import complaints from "./complaints"
import locReports from "./location-reports"
import classes from "./classes"
import schools from "./school"
import teachers from "./teachers"

export default {
  admins,
  routes,
  drivers,
  buses,
  students,
  parents,
  schedules,
  events,
  trips,
  complaints,
  locReports,
  classes,
  schools,
  teachers,
  hello() {
    return "hello mutation";
  }
};
