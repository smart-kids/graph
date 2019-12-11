import { list as admins, single as admin } from "./admins";
import { list as routes, single as route, nested as Nroutes } from "./routes";
import { list as drivers, single as driver } from "./drivers";
import { list as buses, single as bus, nested as Nbuses } from "./buses";
import {
  list as students,
  single as student,
  nested as Nstudent
} from "./students";
import {
  list as schedules,
  single as schedule,
  nested as Nschedule
} from "./schedules";
import {
  list as parents,
  single as parent,
  nested as Nparents
} from "./parents";
import { list as events, single as event, nested as Nevent } from "./events";
import { list as trips, single as trip, nested as Ntrip } from "./trips";
import {
  list as complaints,
  single as complaint,
  nested as Ncomplaint
} from "./complaints";
import {
  list as locReports,
  single as locReport,
  nested as NlocReport
} from "./location-reports";

import {
  list as classes,
  single as classSingle,
  nested as Nclass
} from "./classes"

const nested = {};

Object.assign(
  nested,
  Nstudent,
  Nschedule,
  Nroutes,
  Nbuses,
  Nparents,
  Ntrip,
  Ncomplaint,
  NlocReport,
  Nevent,
  Nclass
);

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

  trips,
  trip,

  complaints,
  complaint,

  locReports,
  locReport,

  events,
  event,

  classes,
  class: classSingle,

  hello: () => "hey"
};

export { Query, nested };
