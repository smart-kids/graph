// create-tables.js
const pg = require('pg');
const { Pool } = pg;
const dotenv = require('dotenv');

// --- Model Imports ---
// Ensure these paths are correct relative to create-tables.js
const admins = require("../src/graphql/resolvers/Mutation/admins/model.js");
const routes = require("../src/graphql/resolvers/Mutation/routes/model.js");
const drivers = require("../src/graphql/resolvers/Mutation/drivers/model.js");
const buses = require("../src/graphql/resolvers/Mutation/buses/model.js");
const students = require("../src/graphql/resolvers/Mutation/students/model.js");
const parents = require("../src/graphql/resolvers/Mutation/parents/model.js");
const schedule = require("../src/graphql/resolvers/Mutation/schedules/model.js");
const event = require("../src/graphql/resolvers/Mutation/event/model.js");
const trip = require("../src/graphql/resolvers/Mutation/trip/model.js");
const complaint = require("../src/graphql/resolvers/Mutation/complaints/model.js");
const locReport = require("../src/graphql/resolvers/Mutation/location-reports/model.js");
const classModel = require("../src/graphql/resolvers/Mutation/classes/model.js");
const school = require("../src/graphql/resolvers/Mutation/school/model.js");
const teacher = require("../src/graphql/resolvers/Mutation/teachers/model.js");
const OTP = require("../src/graphql/resolvers/Mutation/OTP/model.js");
const payments = require("../src/graphql/resolvers/Mutation/payments/model.js");
const charges = require("../src/graphql/resolvers/Mutation/charges/model.js");
const grades = require("../src/graphql/resolvers/Mutation/grades/model.js");
const subjects = require("../src/graphql/resolvers/Mutation/subjects/model.js");
const topics = require("../src/graphql/resolvers/Mutation/topics/model.js");
const subtopics = require("../src/graphql/resolvers/Mutation/subtopics/model.js");
const questions = require("../src/graphql/resolvers/Mutation/questions/model.js");
const answers = require("../src/graphql/resolvers/Mutation/answers/model.js");
const options = require("../src/graphql/resolvers/Mutation/options/model.js");
const terms = require("../src/graphql/resolvers/Mutation/terms/model.js");
const teams = require("../src/graphql/resolvers/Mutation/teams/model.js");
const team_members = require("../src/graphql/resolvers/Mutation/team_members/model.js");
const invitations = require("../src/graphql/resolvers/Mutation/invitations/model.js");
const users = require("../src/graphql/resolvers/Mutation/users/model.js");
const roles = require("../src/graphql/resolvers/Mutation/roles/model.js");
const user_roles = require("../src/graphql/resolvers/Mutation/user_roles/model.js");
const google_users = require("../src/graphql/resolvers/Mutation/google_users/model.js");
const school_creators = require("../src/graphql/resolvers/Mutation/school_creators/model.js");

dotenv.config();

const { DB_URL } = process.env;

if (!DB_URL) {
    console.error("FATAL ERROR: PostgreSQL connection string (DB_URL) is not defined in the environment variables.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: DB_URL,
    // ssl: { rejectUnauthorized: false } // Example SSL config
});

// Helper to map Waterline types to PostgreSQL types
function getPostgresType(attr) {
    if (attr.autoMigrations && attr.autoMigrations.columnType) {
        return attr.autoMigrations.columnType.toUpperCase();
    }
    if (attr.columnType) {
        return attr.columnType.toUpperCase();
    }

    switch (String(attr.type).toLowerCase()) { // Ensure attr.type is a string
        case 'string':
            return 'VARCHAR(255)';
        case 'text':
            return 'TEXT';
        case 'number':
            if (attr.autoMigrations && attr.autoMigrations.autoIncrement) return 'SERIAL';
            // For specific integer types, model should use `columnType: 'INTEGER'` or similar in autoMigrations
            return 'FLOAT'; // Default for 'number' if not auto-incrementing
        case 'boolean':
            return 'BOOLEAN';
        case 'json':
            return 'JSONB';
        case 'date':
            return 'DATE';
        case 'datetime':
            return 'TIMESTAMPTZ';
        default:
            console.warn(`Unknown Waterline type: "${attr.type}" for an attribute. Defaulting to TEXT.`);
            return 'TEXT';
    }
}

const modelModules = [
    admins, routes, drivers, buses, students, parents, schedule, event, trip,
    complaint, locReport, classModel, school, teacher, OTP, payments, charges,
    grades, subjects, topics, subtopics, questions, answers, options, terms,
    teams, team_members, invitations, users, roles, user_roles, google_users,
    school_creators
];

// Mimic the id attribute definition from orm.js's defaultModelSettings
// This is crucial for ensuring the 'id' column is created correctly (e.g., VARCHAR(24))
const defaultIdAttributeDefinition = {
    type: 'string',
    required: true,
    autoMigrations: {
        columnName: 'id', // Though often defaults to attribute name
        primaryKey: true, // This attribute is the primary key
        unique: true,     // Values must be unique
        columnType: 'varchar(24)' // Crucial for string IDs
    }
};


async function createTables() {
    const client = await pool.connect();
    console.log("Connected to PostgreSQL for table creation.");

    try {
        await client.query('BEGIN');

        const triggerFunctionQuery = `
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
               NEW."updatedAt" = NOW();
               RETURN NEW;
            END;
            $$ LANGUAGE 'plpgsql';
        `;
        await client.query(triggerFunctionQuery);
        console.log("Ensured update_updated_at_column trigger function exists.");

        for (const modelModule of modelModules) {
            const extendedCollection = modelModule.default || modelModule;

            // Waterline.Collection.extend stores the definition on the prototype
            // of the returned constructor function.
            const modelIdentity = extendedCollection.prototype && extendedCollection.prototype.identity;
            const rawModelAttributes = extendedCollection.prototype && extendedCollection.prototype.attributes; // Attributes as defined in the model file
            const modelPrimaryKeyName = (extendedCollection.prototype && extendedCollection.prototype.primaryKey) || 'id';


            if (!extendedCollection || typeof extendedCollection.extend !== 'function' || !modelIdentity || typeof rawModelAttributes !== 'object') {
                console.warn("Skipping invalid or unexpected model structure for module:", modelModule);
                if (extendedCollection && extendedCollection.prototype) {
                    console.warn("--> Prototype details: identity=", modelIdentity, ", has attributes object=", !!rawModelAttributes);
                } else if (extendedCollection) {
                    console.warn("--> Direct collection details (no prototype found or not as expected): identity=", extendedCollection.identity, ", attributes=", extendedCollection.attributes);
                }
                continue;
            }

            const tableName = modelIdentity;
            const columnDefinitions = [];

            // --- Primary Key Handling ---
            let pkColumnDefinition = `"${modelPrimaryKeyName}" VARCHAR(24) PRIMARY KEY`; // Default assumption from orm.js

            const pkAttrInModel = rawModelAttributes[modelPrimaryKeyName];
            if (pkAttrInModel) { // If the model explicitly defines its primary key attribute
                let pkType;
                if (pkAttrInModel.autoMigrations && pkAttrInModel.autoMigrations.columnType) {
                    pkType = pkAttrInModel.autoMigrations.columnType.toUpperCase();
                } else if (pkAttrInModel.columnType) {
                    pkType = pkAttrInModel.columnType.toUpperCase();
                } else if (pkAttrInModel.type === 'string' && modelPrimaryKeyName.toLowerCase() === 'id') {
                    // If it's the 'id' PK and type is 'string', use the default VARCHAR(24)
                    pkType = defaultIdAttributeDefinition.autoMigrations.columnType.toUpperCase();
                } else { // For other types like 'number' with autoIncrement, or other custom PKs
                    pkType = getPostgresType(pkAttrInModel);
                }
                pkColumnDefinition = `"${modelPrimaryKeyName}" ${pkType} PRIMARY KEY`;
            } else if (modelPrimaryKeyName.toLowerCase() === 'id') {
                // If PK is 'id' but not in rawModelAttributes, assume default VARCHAR(24)
                pkColumnDefinition = `"${modelPrimaryKeyName}" ${defaultIdAttributeDefinition.autoMigrations.columnType.toUpperCase()} PRIMARY KEY`;
            }
            columnDefinitions.push(pkColumnDefinition);


            // --- Other Attributes ---
            for (const attrName in rawModelAttributes) {
                if (attrName.toLowerCase() === modelPrimaryKeyName.toLowerCase()) continue; // Already handled

                const attr = rawModelAttributes[attrName];

                if (attr.model || attr.collection) { // Skip associations
                    console.log(`Info: Skipping association attribute "${attrName}" for table "${tableName}".`);
                    continue;
                }
                if (typeof attr !== 'object' || attr === null || !attr.type) {
                    console.log(`Info: Skipping attribute "${attrName}" for table "${tableName}" (not a standard attribute definition). Value:`, attr);
                    continue;
                }

                let columnDef = `"${attrName}" ${getPostgresType(attr)}`;

                if (attr.required && !(attr.autoMigrations && attr.autoMigrations.autoIncrement) && attr.defaultsTo === undefined) {
                    columnDef += ' NOT NULL';
                }

                if (attr.defaultsTo !== undefined) {
                    let defaultValue = attr.defaultsTo;
                    if (typeof defaultValue === 'string') {
                        defaultValue = `'${String(defaultValue).replace(/'/g, "''")}'`; // Escape single quotes
                    } else if (typeof defaultValue === 'boolean') {
                        defaultValue = defaultValue ? 'TRUE' : 'FALSE';
                    } else if (typeof defaultValue === 'number' && Number.isFinite(defaultValue)) {
                        // Number is fine as is
                    } else {
                        console.warn(`Warning: Unsupported default value type for ${tableName}.${attrName}: ${typeof defaultValue} ('${defaultValue}'). Omitting DEFAULT clause.`);
                        defaultValue = null; // Avoid adding default for unsupported types
                    }
                    if (defaultValue !== null) columnDef += ` DEFAULT ${defaultValue}`;
                }

                if (attr.autoMigrations && attr.autoMigrations.unique) {
                    columnDef += ' UNIQUE';
                }
                columnDefinitions.push(columnDef);
            }

            // Standard timestamp columns
            columnDefinitions.push(`"createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`);
            columnDefinitions.push(`"updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`);

            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS "${tableName}" (
                    ${columnDefinitions.join(',\n                    ')}
                );
            `;

            console.log(`\nExecuting SQL for table: ${tableName}`);
            // console.log(createTableQuery); // Uncomment to debug generated SQL
            await client.query(createTableQuery);
            console.log(`Table "${tableName}" ensured.`);

            // Apply updatedAt trigger
            const dropTriggerQuery = `DROP TRIGGER IF EXISTS "${tableName}_update_updated_at" ON "${tableName}";`;
            const createTriggerQuery = `
                CREATE TRIGGER "${tableName}_update_updated_at"
                BEFORE UPDATE ON "${tableName}"
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
            `;
            await client.query(dropTriggerQuery);
            await client.query(createTriggerQuery);
            console.log(`Applied updatedAt trigger to "${tableName}".`);
        }

        // --- Special case: Create table for the test script ---
        const testTableName = 'tests_isolated';
        const createTestTableQuery = `
            CREATE TABLE IF NOT EXISTS "${testTableName}" (
                "id" SERIAL PRIMARY KEY,
                "counter" VARCHAR(255),
                "description" TEXT,
                "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `;
        console.log(`\nExecuting SQL for table: ${testTableName}`);
        await client.query(createTestTableQuery);
        console.log(`Table "${testTableName}" ensured for testing.`);
        const dropTestTriggerQuery = `DROP TRIGGER IF EXISTS "${testTableName}_update_updated_at" ON "${testTableName}";`;
        const createTestTriggerQuery = `
            CREATE TRIGGER "${testTableName}_update_updated_at"
            BEFORE UPDATE ON "${testTableName}"
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        `;
        await client.query(dropTestTriggerQuery);
        await client.query(createTestTriggerQuery);
        console.log(`Applied updatedAt trigger to "${testTableName}".`);


        await client.query('COMMIT');
        console.log("\nAll tables processed successfully.");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error during table creation, transaction rolled back:", err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        console.log("Disconnected from PostgreSQL.");
    }
}

createTables().catch(err => {
    console.error("Unhandled error in createTables main execution:", err);
    process.exit(1);
});