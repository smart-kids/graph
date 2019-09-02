import { list as admins, single as admin } from "./admins";
import { list as routes, single as route } from "./routes";
import { list as drivers, single as driver } from "./drivers";
import { list as buses, single as bus } from "./buses";
import { list as students, single as student } from "./students";
import { list as parents, single as parent } from "./parents";

export default {
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

  hello: () => "test"
};
