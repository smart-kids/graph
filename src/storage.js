import Waterline from "waterline";
import PostgresAdapter from "sails-postgresql";
import pg from 'pg';

// Your model imports (ensure these are correct, accessible, and export plain model definition objects)
import admins from "./graphql/resolvers/Mutation/admins/model.js";
import routes from "./graphql/resolvers/Mutation/routes/model.js";
import drivers from "./graphql/resolvers/Mutation/drivers/model.js";
import buses from "./graphql/resolvers/Mutation/buses/model.js";
import students from "./graphql/resolvers/Mutation/students/model.js";
import parents from "./graphql/resolvers/Mutation/parents/model.js";
import schedule from "./graphql/resolvers/Mutation/schedules/model.js";
import event from "./graphql/resolvers/Mutation/event/model.js";
import trip from "./graphql/resolvers/Mutation/trip/model.js";
import complaint from "./graphql/resolvers/Mutation/complaints/model.js";
import locReport from "./graphql/resolvers/Mutation/location-reports/model.js";
import classModel from "./graphql/resolvers/Mutation/classes/model.js";
import school from "./graphql/resolvers/Mutation/school/model.js";
import teacher from "./graphql/resolvers/Mutation/teachers/model.js";
import OTP from "./graphql/resolvers/Mutation/OTP/model.js";
import payments from "./graphql/resolvers/Mutation/payments/model.js";
import charges from "./graphql/resolvers/Mutation/charges/model.js";
import grades from "./graphql/resolvers/Mutation/grades/model.js";
import subjects from "./graphql/resolvers/Mutation/subjects/model.js";
import topics from "./graphql/resolvers/Mutation/topics/model.js";
import subtopics from "./graphql/resolvers/Mutation/subtopics/model.js";
import questions from "./graphql/resolvers/Mutation/questions/model.js";
import answers from "./graphql/resolvers/Mutation/answers/model.js";
import options from "./graphql/resolvers/Mutation/options/model.js";
import terms from "./graphql/resolvers/Mutation/terms/model.js";
import teams from "./graphql/resolvers/Mutation/teams/model.js";
import team_members from "./graphql/resolvers/Mutation/team_members/model.js";
import invitations from "./graphql/resolvers/Mutation/invitations/model.js";
import users from "./graphql/resolvers/Mutation/users/model.js";
import roles from "./graphql/resolvers/Mutation/roles/model.js";
import user_roles from "./graphql/resolvers/Mutation/user_roles/model.js";
import google_users from "./graphql/resolvers/Mutation/google_users/model.js";
import school_creators from "./graphql/resolvers/Mutation/school_creators/model.js";
import analytics_event from "./graphql/resolvers/Mutation/analytics-event/model.js";
import lessonAttempts from "./graphql/resolvers/Mutation/lessonAttempt/model.js";
import attemptEvents from "./graphql/resolvers/Mutation/attemptEvent/model.js";
import smsEvents from "./graphql/resolvers/Mutation/sms/event-model.js";
import smsLogs from "./graphql/resolvers/Mutation/sms/log-model.js";
import books from "./graphql/resolvers/Mutation/library/model.js";
import assessments from "./graphql/resolvers/Mutation/assessments/model.js";
import assessmentType from "./graphql/resolvers/Mutation/assessment-types/model.js";
import assessmentRubric from "./graphql/resolvers/Mutation/assessment-rubrics/model.js";

const {
    NODE_ENV,
    DB_URL,
} = process.env;

console.log(`Initializing Waterline for NODE_ENV: ${NODE_ENV}`);

if (!DB_URL) {
    console.error("FATAL ERROR: PostgreSQL connection string (DB_URL) is not defined in the environment variables.");
    process.exit(1);
}

// Monkey-patch the adapter to get access to the underlying pool
const originalInitialize = PostgresAdapter.initialize;
PostgresAdapter.initialize = function (datastoreConfig, cb) {
    originalInitialize(datastoreConfig, (err, datastore) => {
        if (datastore && datastore.driver && datastore.driver.pool) {
            console.log("Attaching error listener to the PostgreSQL connection pool.");
            // Listen for errors on the pool
            datastore.driver.pool.on('error', (poolErr) => {
                console.error('PostgreSQL Pool Error:', poolErr);
            });
        }
        cb(err, datastore);
    });
};

const datastoreConfig = {
    adapter: 'postgres',
    url: DB_URL,
    migrate: 'safe',

    // The `sails-postgresql` adapter passes these settings down to the `pg` pool.
    pool: {
        min: 0,
        max: 10,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
    }
};

const waterlineInstance = new Waterline();

// Register all your models
// These should be plain JavaScript objects (model definitions)
waterlineInstance.registerModel(admins);
waterlineInstance.registerModel(routes);
waterlineInstance.registerModel(drivers);
waterlineInstance.registerModel(buses);
waterlineInstance.registerModel(students);
waterlineInstance.registerModel(parents);
waterlineInstance.registerModel(schedule);
waterlineInstance.registerModel(event);
waterlineInstance.registerModel(trip);
waterlineInstance.registerModel(complaint);
waterlineInstance.registerModel(locReport);
waterlineInstance.registerModel(classModel);
waterlineInstance.registerModel(school);
waterlineInstance.registerModel(teacher);
waterlineInstance.registerModel(OTP);
waterlineInstance.registerModel(payments);
waterlineInstance.registerModel(charges);
waterlineInstance.registerModel(grades);
waterlineInstance.registerModel(subjects);
waterlineInstance.registerModel(topics);
waterlineInstance.registerModel(subtopics);
waterlineInstance.registerModel(questions);
waterlineInstance.registerModel(answers);
waterlineInstance.registerModel(options);
waterlineInstance.registerModel(terms);
waterlineInstance.registerModel(teams);
waterlineInstance.registerModel(team_members);
waterlineInstance.registerModel(invitations);
waterlineInstance.registerModel(users);
waterlineInstance.registerModel(roles);
waterlineInstance.registerModel(user_roles);
waterlineInstance.registerModel(google_users);
waterlineInstance.registerModel(school_creators);
waterlineInstance.registerModel(analytics_event);
waterlineInstance.registerModel(lessonAttempts);
waterlineInstance.registerModel(attemptEvents);
waterlineInstance.registerModel(smsEvents);
waterlineInstance.registerModel(smsLogs);
waterlineInstance.registerModel(books);
waterlineInstance.registerModel(assessments);
waterlineInstance.registerModel(assessmentType);
waterlineInstance.registerModel(assessmentRubric);

const config = {
    adapters: {
        postgres: PostgresAdapter,
    },
    datastores: {
        default: datastoreConfig,
    },
    defaultModelSettings: {
        migrate: 'safe',
    },
};

export default new Promise((resolve, reject) => {
    console.log("Attempting to initialize Waterline ORM...");
    waterlineInstance.initialize(config, (err, orm) => {
        if (err) {
            console.error("FATAL ERROR: Waterline ORM initialization failed:", err);
            if (err.originalError) {
                console.error("Underlying Driver Error:", err.originalError);
            }
            return reject(err);
        }
        console.log("Waterline ORM initialized successfully.");
        if (orm.connections && orm.connections.default) {
             console.log("Successfully connected to PostgreSQL.");
        }
        resolve(orm);
    });
});