import Waterline from "waterline";
import PostgresAdapter from "sails-postgresql";

// Your model imports (ensure these are correct, accessible, and export plain model definition objects)
// Added .js extension for explicitness in ESM environments.
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
import classModel from "./graphql/resolvers/Mutation/classes/model.js"; // Renamed from 'class' to 'classModel' in import
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

const {
    NODE_ENV,
    DB_URL,
} = process.env;

console.log(`Initializing Waterline for NODE_ENV: ${NODE_ENV}`);

if (!DB_URL) {
    console.error("FATAL ERROR: PostgreSQL connection string (DB_URL) is not defined in the environment variables.");
    process.exit(1); // Exit if DB_URL is not set
}

const datastoreConfig = {
    adapter: 'postgres',
    url: DB_URL,
    migrate: 'safe', // Good for production.
    
    // --- ADD THIS POOL CONFIGURATION ---
    // The `sails-postgresql` adapter passes these settings down to the `pg` pool.
    pool: {
        min: 0,
        max: 10, // Increased from 5, adjust based on expected load.
        idleTimeoutMillis: 30000, // Close idle connections after 30 seconds.
        acquireTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
    }
};

console.log("Waterline Configuration: Using PostgreSQL. DB_URL is set.");
if (datastoreConfig.migrate === 'alter') {
    console.warn("WARNING: Waterline 'migrate' is set to 'alter'. This will attempt to automatically adjust your database schema. Use with caution and set to 'safe' for production.");
}

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
waterlineInstance.registerModel(classModel); // Using the imported name 'classModel'
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

const config = {
    adapters: {
        postgres: PostgresAdapter,
    },
    datastores: {
        default: datastoreConfig // All models will use this datastore by default
    },
    defaultModelSettings: {
        datastore: 'default',
        primaryKey: 'id', // Name of the primary key attribute for all models
        attributes: {
            id: {
                type: 'string',   // ID type is string
                required: true,   // Crucial: Application MUST provide the ID value
                autoMigrations: {
                    columnName: 'id', // Explicitly set column name (though often defaults to attribute name)
                    primaryKey: true, // This attribute is the primary key
                    unique: true,     // Values must be unique
                    // For PostgreSQL, define the column type for string IDs.
                    // 'varchar(24)' is suitable for 24-character hex strings (like MongoDB ObjectIds).
                    // If your IDs might be longer, adjust accordingly (e.g., 'varchar(36)' for UUIDs).
                    columnType: 'varchar(24)'
                }
            },
            // Waterline automatically adds `createdAt` and `updatedAt` timestamps.
            // With `sails-postgresql`, these will default to `TIMESTAMPTZ` in PostgreSQL.
            // If you need UNIX timestamps (numbers), you can configure them explicitly:
            // createdAt: { type: 'number', autoCreatedAt: true, autoMigrations: { columnType: 'bigint' } },
            // updatedAt: { type: 'number', autoUpdatedAt: true, autoMigrations: { columnType: 'bigint' } },
        },
        // `schema: true` is the default for SQL adapters in Waterline v0.13+.
        // It means any attributes in .create() or .update() calls that are not defined
        // in the model's attributes will be ignored.
        // schema: true,
    }
};

export default new Promise((resolve, reject) => {
    waterlineInstance.initialize(config, (err, orm) => {
        if (err) {
            console.error("FATAL ERROR: Waterline ORM initialization failed:", err);
            // It's often better to throw the error or reject the promise and let the application crash
            // or handle it at a higher level, rather than process.exit() here.
            return reject(err);
        }
        console.log("Waterline ORM initialized successfully.");
        if (datastoreConfig.migrate === 'alter') {
            console.log("Schema modifications (if any) should have been applied by Waterline according to 'alter' strategy.");
            console.warn("IMPORTANT: Remember to set 'migrate: safe' in your datastore config before deploying to production. Use a dedicated migration tool for schema changes in production.");
        }
        resolve(orm);
    });
});