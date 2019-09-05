import { list as admins, single as admin } from "./admins";
import { list as routes, single as route, nested as Nroutes } from "./routes";
import { list as drivers, single as driver } from "./drivers";
import { list as buses, single as bus } from "./buses";
import { list as students, single as student, nested as Nstudent } from "./students";
import { list as schedules, single as schedule, nested as Nschedule } from "./schedules";
import { list as parents, single as parent } from "./parents";

const nested = {};

Object.assign(nested, Nstudent, Nschedule, Nroutes)

const Query = {
  admins,
  admin,

  routes,
  route,

  drivers,
  driver,

  buses,
  bus,

  students,
  student,

  parents,
  parent,

  schedules,
  schedule,

  hello: () => "test"
};

export {
  Query,
  nested
} 
