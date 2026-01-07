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
import payments from "./payments"
import charges from "./charges"
import sms from "./sms"
import grades from "./grades"
import subjects from "./subjects"
import topics from "./topics"
import subtopics from "./subtopics"
import questions from "./questions"
import answers from "./answers"
import options from "./options"
import terms from "./terms"
import teams from "./teams"
import team_members from "./team_members"
import invitations from "./invitations"
import responses from "./responses"
import analyticsEvent from "./analytics-event";
import lessonAttempts from "./lessonAttempt";
import attemptEvents from "./attemptEvent";
import books from "./library";

export default {
  admins,
  charges,
  payments,
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
  sms,
  grades,
  subjects,
  topics,
  subtopics,
  questions,
  answers,
  options,
  terms,
  teams,
  team_members,
  invitations,
  responses,
  analyticsEvent,
  lessonAttempts,
  attemptEvents,
  books,
  hello() {
    return "hello mutation";
  }
};
