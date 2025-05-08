import Waterline from "waterline";
import PostgresAdapter from "sails-postgresql";

// Your model imports (ensure these are correct and accessible)
import admins from "./graphql/resolvers/Mutation/admins/model";
import routes from "./graphql/resolvers/Mutation/routes/model";
import drivers from "./graphql/resolvers/Mutation/drivers/model";
import buses from "./graphql/resolvers/Mutation/buses/model";
import students from "./graphql/resolvers/Mutation/students/model";
import parents from "./graphql/resolvers/Mutation/parents/model";
import schedule from "./graphql/resolvers/Mutation/schedules/model";
import event from "./graphql/resolvers/Mutation/event/model";
import trip from "./graphql/resolvers/Mutation/trip/model";
import complaint from "./graphql/resolvers/Mutation/complaints/model";
import locReport from "./graphql/resolvers/Mutation/location-reports/model";
import classModel from "./graphql/resolvers/Mutation/classes/model";
import school from "./graphql/resolvers/Mutation/school/model";
import teacher from "./graphql/resolvers/Mutation/teachers/model";
import OTP from "./graphql/resolvers/Mutation/OTP/model";
import payments from "./graphql/resolvers/Mutation/payments/model";
import charges from "./graphql/resolvers/Mutation/charges/model";
import grades from "./graphql/resolvers/Mutation/grades/model";
import subjects from "./graphql/resolvers/Mutation/subjects/model";
import topics from "./graphql/resolvers/Mutation/topics/model";
import subtopics from "./graphql/resolvers/Mutation/subtopics/model";
import questions from "./graphql/resolvers/Mutation/questions/model";
import answers from "./graphql/resolvers/Mutation/answers/model";
import options from "./graphql/resolvers/Mutation/options/model";
import terms from "./graphql/resolvers/Mutation/terms/model";
import teams from "./graphql/resolvers/Mutation/teams/model";
import team_members from "./graphql/resolvers/Mutation/team_members/model";
import invitations from "./graphql/resolvers/Mutation/invitations/model";
import users from "./graphql/resolvers/Mutation/users/model";
import roles from "./graphql/resolvers/Mutation/roles/model";
import user_roles from "./graphql/resolvers/Mutation/user_roles/model";
import google_users from "./graphql/resolvers/Mutation/google_users/model";
import school_creators from "./graphql/resolvers/Mutation/school_creators/model";

const {
    NODE_ENV,
    DB_URL,
} = process.env;

console.log(`Initializing Waterline for NODE_ENV: ${NODE_ENV}`);

if (!DB_URL) {
    console.error("FATAL ERROR: PostgreSQL connection string (DB_URL) is not defined in the environment variables.");
    process.exit(1);
}

const datastoreConfig = {
    adapter: 'postgres',
    url: DB_URL,
    // TEMPORARILY SET TO 'alter' FOR INITIAL SCHEMA CREATION WITH STRING IDs.
    // REMEMBER TO CHANGE BACK TO 'safe' BEFORE PRODUCTION OR FOR CONTROLLED MIGRATIONS.
    migrate: 'alter',
    // ssl: {} // Add SSL config if needed for your new instance
};

console.log("Waterline Configuration: Using PostgreSQL. DB_URL is set.");
if (datastoreConfig.migrate === 'alter') {
    console.warn("WARNING: Waterline 'migrate' is set to 'alter'. This will attempt to automatically adjust your database schema. Use with caution and set to 'safe' for production.");
}


var waterline = new Waterline();

// Register all your models
waterline.registerModel(admins);
waterline.registerModel(routes);
waterline.registerModel(drivers);
waterline.registerModel(buses);
waterline.registerModel(students);
waterline.registerModel(parents);
waterline.registerModel(schedule);
waterline.registerModel(event);
waterline.registerModel(trip);
waterline.registerModel(complaint);
waterline.registerModel(locReport);
waterline.registerModel(classModel);
waterline.registerModel(school);
waterline.registerModel(teacher);
waterline.registerModel(payments);
waterline.registerModel(charges);
waterline.registerModel(grades);
waterline.registerModel(subjects);
waterline.registerModel(topics);
waterline.registerModel(subtopics);
waterline.registerModel(questions);
waterline.registerModel(answers);
waterline.registerModel(options);
waterline.registerModel(terms);
waterline.registerModel(teams);
waterline.registerModel(team_members);
waterline.registerModel(invitations);
waterline.registerModel(OTP);
waterline.registerModel(users);
waterline.registerModel(roles);
waterline.registerModel(user_roles);
waterline.registerModel(google_users);
waterline.registerModel(school_creators);


var config = {
    adapters: {
        postgres: PostgresAdapter,
    },
    datastores: {
        default: datastoreConfig
    },
    defaultModelSettings: {
        datastore: 'default',
        primaryKey: 'id',     // Name of the primary key attribute
        attributes: {
            id: {
                type: 'string',   // ID is now a string
                required: true,   // Application MUST provide it
                // columnName: 'id', // Waterline defaults to attribute name, usually not needed
                autoMigrations: {
                    // autoIncrement: false, // Explicitly false or removed, DB doesn't generate it
                    primaryKey: true,
                    unique: true,
                    columnType: 'varchar(24)' // Define PG column type for string IDs (e.g., MongoDB ObjectId hex strings)
                                              // CHAR(24) is also an option if IDs are always 24 chars.
                }
            },
            // Waterline automatically adds `createdAt` and `updatedAt`
            // Their types will be TIMESTAMPTZ in PostgreSQL by default with sails-postgresql
            // If you want to be explicit or change the type (e.g., to 'number' for UNIX timestamp):
            // createdAt: { type: 'number', autoCreatedAt: true, autoMigrations: { columnType: 'bigint' } },
            // updatedAt: { type: 'number', autoUpdatedAt: true, autoMigrations: { columnType: 'bigint' } },
            // However, TIMESTAMPTZ is generally preferred for timestamps.
        },
        // schema: true, // Waterline v0.13+ sets `schema: true` by default for SQL adapters.
                        // It's good to be aware of this; means undeclared attributes are ignored.
    }
};

export default new Promise((resolve, reject) => {
    waterline.initialize(config, (err, orm) => {
        if (err) {
            console.error("FATAL ERROR: Waterline ORM initialization failed:", err);
            return reject(err);
        }
        console.log("Waterline ORM initialized successfully.");
        if (datastoreConfig.migrate === 'alter') {
            console.log("Schema modifications (if any) should have been applied by Waterline.");
            console.warn("IMPORTANT: Remember to set 'migrate: safe' in your datastore config before deploying to production or when you want full control over schema changes via a migration tool.");
        }
        resolve(orm);
    });
});