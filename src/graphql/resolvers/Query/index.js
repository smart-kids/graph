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
  single as user,
} from "./user";

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
  list as charges,
  single as charge,
  nested as Ncharges
} from "./charges";

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

import {
  list as teachers,
  single as teacher,
  nested as Nteacher
} from "./teachers"

import {
  single as school,
  list as schools,
  nested as Nschool
} from "./school"

import {
  list as grades,
  single as grade,
  nested as Ngrade
} from "./grades";

import {
  list as subjects,
  single as subject,
  nested as Nsubject
} from "./subjects";

import {
  list as topics,
  single as topic,
  nested as Ntopic
} from "./topics";

import {
  list as subtopics,
  single as subtopic,
  nested as Nsubtopic
} from "./subtopics";

import {
  list as questions,
  single as question,
  nested as Nquestion
} from "./questions";

import {
  list as answers,
  single as answer,
  nested as Nanswer
} from "./answers";

const nested = {};

Object.assign(
  nested,
  Nschool,
  Ncharges,
  Nstudent,
  Nschedule,
  Nroutes,
  Nbuses,
  Nparents,
  Ntrip,
  Ncomplaint,
  NlocReport,
  Nevent,
  Nclass,
  Nteacher,
  Ngrade,
  Nsubject,
  Ntopic,
  Nsubtopic,
  Nquestion,
  Nanswer,
);

const Query = {
  user,
  
  schools,
  school,

  admins,
  admin,

  charges,
  charge,

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

  teachers,
  teacher,

  school,

  grade,
  grades,

  subject,
  subjects,

  topic,
  topics,

  subtopic,
  subtopics,

  question,
  questions,

  answer,
  answers,

  hello: () => "hey"
};

export { Query, nested };
