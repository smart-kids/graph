// create-tables-fully-automatic.js
const pg = require('pg');
const { Pool } = pg;
const dotenv = require('dotenv');
const readline = require('readline'); // For a more interactive confirmation (optional)

// --- Model Imports ---
// ... (all your model imports are correct)
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

// Helper to map Waterline types to PostgreSQL types (This function is now correct)
function getPostgresType(attr) {
    // Helper to sanitize raw type strings from models. It trims whitespace and removes any trailing semicolon.
    const sanitize = (typeStr) => String(typeStr).trim().replace(/;$/, '');

    if (attr.autoMigrations && attr.autoMigrations.columnType) {
        // Sanitize the raw type to prevent SQL syntax errors from extra semicolons.
        return sanitize(attr.autoMigrations.columnType).toUpperCase();
    }
    if (attr.columnType) { // Mainly for sails-postgresql adapter specifics
        // Sanitize the raw type to prevent SQL syntax errors from extra semicolons.
        return sanitize(attr.columnType).toUpperCase();
    }

    switch (String(attr.type).toLowerCase()) {
        case 'string': return 'VARCHAR(255)';
        case 'text': return 'TEXT';
        case 'number':
            if (attr.autoMigrations && attr.autoMigrations.autoIncrement) return 'SERIAL';
            return 'FLOAT';
        case 'boolean': return 'BOOLEAN';
        case 'json': return 'JSONB'; // This is clean
        case 'date': return 'DATE';
        case 'datetime': return 'TIMESTAMPTZ';
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

const defaultIdAttributeDefinition = {
    type: 'string',
    required: true,
    autoMigrations: {
        columnName: 'id',
        primaryKey: true,
        unique: true,
        columnType: 'varchar(24)'
    }
};

function normalizeDbType(udtName, dataType, charMaxLength) {
    let type = udtName.toUpperCase();
    if (type === 'VARCHAR' && dataType.toUpperCase() === 'CHARACTER VARYING') {
        return charMaxLength ? `VARCHAR(${charMaxLength})` : 'VARCHAR';
    }
    if (type === 'BPCHAR' && dataType.toUpperCase() === 'CHARACTER') {
        return charMaxLength ? `CHAR(${charMaxLength})` : 'CHAR';
    }
    if (type === 'INT4') return 'INTEGER';
    if (type === 'INT8') return 'BIGINT';
    if (type === 'INT2') return 'SMALLINT';
    if (type === 'BOOL') return 'BOOLEAN';
    return type;
}

async function manageSchema(cleanDatabaseFirst = false) {
    console.log('Connecting to PostgreSQL...');
    const client = await pool.connect();
    console.log('Connected to PostgreSQL.');

    try {
        await client.query('BEGIN');

        if (cleanDatabaseFirst) {
            console.log('\n--- Starting Database Cleaning (DROPPING TABLES) ---');
            console.warn('!!! WARNING: ALL DATA IN THE TARGETED TABLES WILL BE LOST. !!!');

            console.log('Attempting to drop trigger function "update_updated_at_column" if it exists...');
            // FIX: Removed semicolon
            await client.query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE');
            console.log('Trigger function "update_updated_at_column" dropped or did not exist.');


            for (const modelModule of [...modelModules].reverse()) {
                const extendedCollection = modelModule.default || modelModule;
                const modelIdentity = extendedCollection.prototype && extendedCollection.prototype.identity;
                if (!modelIdentity) {
                    console.warn("Skipping invalid model structure for dropping (no identity):", modelModule);
                    continue;
                }
                const tableName = modelIdentity;
                console.log(`  Dropping table "${tableName}" IF EXISTS...`);
                // FIX: Removed semicolon
                await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
                console.log(`  Table "${tableName}" dropped or did not exist.`);
            }

            const testTableName = 'tests_isolated';
            console.log(`  Dropping table "${testTableName}" IF EXISTS...`);
            // FIX: Removed semicolon
            await client.query(`DROP TABLE IF EXISTS "${testTableName}" CASCADE`);
            console.log(`  Table "${testTableName}" dropped or did not exist.`);

            console.log('--- Database Cleaning Complete ---');
        }


        console.log('\n--- Starting Schema Synchronization ---');
        // ... (warnings are correct)


        console.log('Ensuring update_updated_at_column trigger function...');
        const triggerFunctionQuery = `
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
               NEW."updatedAt" = NOW();
               RETURN NEW;
            END;
            $$ LANGUAGE 'plpgsql'
        `; // FIX: Removed semicolon from end of template literal
        await client.query(triggerFunctionQuery);
        console.log('Trigger function "update_updated_at_column" ensured.');

        for (const modelModule of modelModules) {
            // ... (model introspection logic is correct)
            const extendedCollection = modelModule.default || modelModule;
            const modelIdentity = extendedCollection.prototype && extendedCollection.prototype.identity;
            const rawModelAttributes = extendedCollection.prototype && extendedCollection.prototype.attributes;
            let modelPrimaryKeyName = (extendedCollection.prototype && extendedCollection.prototype.primaryKey) || 'id';

            if (!extendedCollection || typeof extendedCollection.extend !== 'function' || !modelIdentity || typeof rawModelAttributes !== 'object') {
                console.warn("Skipping invalid model structure for module (no .extend, identity, or attributes):", modelModule);
                continue;
            }
            if (Object.keys(rawModelAttributes).length === 0 && modelPrimaryKeyName.toLowerCase() !== 'id') { // Allow empty attributes if implicit ID is the only thing
                 console.warn(`Skipping model "${modelIdentity}" as it has no attributes defined and primary key is not 'id'.`);
                 continue;
            }

            const tableName = modelIdentity;
            console.log(`\nProcessing table: "${tableName}"`);

            // ... (schema and column definition logic is correct)
            const desiredSchema = {};
            const pkAttrKeyInModel = Object.keys(rawModelAttributes).find(k => k.toLowerCase() === modelPrimaryKeyName.toLowerCase()) || modelPrimaryKeyName;
            let pkColumnDefinition = `"${modelPrimaryKeyName}" VARCHAR(24) PRIMARY KEY`;
            const pkAttrInModel = rawModelAttributes[pkAttrKeyInModel];

            if (pkAttrInModel) {
                let pkType = getPostgresType(pkAttrInModel);
                if (pkAttrKeyInModel.toLowerCase() === 'id' && modelPrimaryKeyName.toLowerCase() === 'id' &&
                    (!pkAttrInModel.autoMigrations || !pkAttrInModel.autoMigrations.columnType)) {
                    pkType = defaultIdAttributeDefinition.autoMigrations.columnType.toUpperCase();
                }
                pkColumnDefinition = `"${modelPrimaryKeyName}" ${pkType} PRIMARY KEY`;
                desiredSchema[modelPrimaryKeyName.toLowerCase()] = { name: modelPrimaryKeyName, definition: pkColumnDefinition, pgType: pkType, isPk: true, modelAttr: pkAttrInModel || defaultIdAttributeDefinition };
            } else if (modelPrimaryKeyName.toLowerCase() === 'id') {
                 pkColumnDefinition = `"${modelPrimaryKeyName}" ${defaultIdAttributeDefinition.autoMigrations.columnType.toUpperCase()} PRIMARY KEY`;
                 desiredSchema[modelPrimaryKeyName.toLowerCase()] = { name: modelPrimaryKeyName, definition: pkColumnDefinition, pgType: defaultIdAttributeDefinition.autoMigrations.columnType.toUpperCase(), isPk: true, modelAttr: defaultIdAttributeDefinition };
            } else {
                console.error(`  ERROR: Primary key "${modelPrimaryKeyName}" not found in attributes for table "${tableName}". Skipping table.`);
                continue;
            }

            const columnDefinitionsForCreate = [pkColumnDefinition];
            for (const attrName in rawModelAttributes) {
                if (attrName.toLowerCase() === modelPrimaryKeyName.toLowerCase()) continue;
                const attr = rawModelAttributes[attrName];
                if (attr.model || attr.collection || typeof attr !== 'object' || attr === null || !attr.type) {
                    if (attr.model || attr.collection) console.log(`  Info: Skipping association attribute "${attrName}".`);
                    else console.log(`  Info: Skipping non-standard attribute "${attrName}".`);
                    continue;
                }

                let pgType = getPostgresType(attr);
                let columnDef = `"${attrName}" ${pgType}`;
                if (attr.required && !(attr.autoMigrations && attr.autoMigrations.autoIncrement) && attr.defaultsTo === undefined) {
                    columnDef += ' NOT NULL';
                }
                if (attr.defaultsTo !== undefined) {
                    let defaultValue = attr.defaultsTo;
                    if (typeof defaultValue === 'string') defaultValue = `'${String(defaultValue).replace(/'/g, "''")}'`;
                    else if (typeof defaultValue === 'boolean') defaultValue = defaultValue ? 'TRUE' : 'FALSE';
                    else if (typeof defaultValue === 'function') {
                        try {
                            const val = defaultValue();
                            if (typeof val === 'string') defaultValue = `'${String(val).replace(/'/g, "''")}'`;
                            else if (typeof val === 'boolean') defaultValue = val ? 'TRUE' : 'FALSE';
                            else if (typeof val === 'number' && Number.isFinite(val)) defaultValue = val;
                            else if (val instanceof Date) defaultValue = `'${val.toISOString()}'`;
                            else {
                                console.warn(`  Warning: Unsupported dynamic default value for ${tableName}.${attrName}. Omitting DEFAULT.`);
                                defaultValue = null;
                            }
                        } catch (e) {
                            console.warn(`  Warning: Error evaluating dynamic default for ${tableName}.${attrName}. Omitting DEFAULT. Error: ${e.message}`);
                            defaultValue = null;
                        }
                    }
                    if (defaultValue !== null) columnDef += ` DEFAULT ${defaultValue}`;
                }
                if (attr.autoMigrations && attr.autoMigrations.unique) {
                    columnDef += ' UNIQUE';
                }
                columnDefinitionsForCreate.push(columnDef);
                desiredSchema[attrName.toLowerCase()] = { name: attrName, definition: columnDef, pgType: pgType, modelAttr: attr };
            }
            if (!desiredSchema['createdat']) {
                 desiredSchema['createdat'] = { name: 'createdAt', definition: '"createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP', pgType: 'TIMESTAMPTZ', modelAttr: { type: 'datetime', defaultsTo: 'CURRENT_TIMESTAMP' } };
                 columnDefinitionsForCreate.push(desiredSchema['createdat'].definition);
            }
            if (!desiredSchema['updatedat']) {
                desiredSchema['updatedat'] = { name: 'updatedAt', definition: '"updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP', pgType: 'TIMESTAMPTZ', modelAttr: { type: 'datetime', defaultsTo: 'CURRENT_TIMESTAMP' } };
                columnDefinitionsForCreate.push(desiredSchema['updatedat'].definition);
            }

            const tableExistsRes = await client.query(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1);",
                [tableName]
            );
            const tableExists = tableExistsRes.rows[0].exists;

            if (!tableExists) {
                console.log(`  Creating table "${tableName}"...`);
                // FIX: Removed semicolon from end of template literal
                const createTableQuery = `CREATE TABLE "${tableName}" (\n    ${columnDefinitionsForCreate.join(',\n    ')}\n)`;
                await client.query(createTableQuery);
                console.log(`  Table "${tableName}" created.`);
            } else if (!cleanDatabaseFirst) {
                // ... (column diff logic is correct)
                console.log(`  Verifying columns for existing table "${tableName}"...`);
                const { rows: existingDbColumnsData } = await client.query(
                    `SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length, numeric_precision, numeric_scale
                     FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = $1;`,
                    [tableName]
                );
                const existingColumnMap = new Map(existingDbColumnsData.map(col => [col.column_name.toLowerCase(), col]));

                const columnsToAdd = [];
                for (const modelColNameLower in desiredSchema) {
                    if (!existingColumnMap.has(modelColNameLower)) {
                        columnsToAdd.push(desiredSchema[modelColNameLower]);
                    }
                }

                const columnsToRemove = [];
                existingColumnMap.forEach((dbCol, dbColNameLower) => {
                    if (!desiredSchema[dbColNameLower]) {
                        if (dbColNameLower !== modelPrimaryKeyName.toLowerCase() &&
                            dbColNameLower !== 'createdat' && dbColNameLower !== 'updatedat') {
                             columnsToRemove.push(dbCol);
                        }
                    }
                });

                const columnsToModify = [];
                for (const modelColNameLower in desiredSchema) {
                    const modelAttrDetails = desiredSchema[modelColNameLower];
                    const existingDbCol = existingColumnMap.get(modelColNameLower);

                    if (existingDbCol && !modelAttrDetails.isPk) {
                        const modelPgType = modelAttrDetails.pgType.toUpperCase();
                        const dbNormalizedType = normalizeDbType(existingDbCol.udt_name, existingDbCol.data_type, existingDbCol.character_maximum_length);
                        const modelAttr = modelAttrDetails.modelAttr;
                        const alterations = [];

                        if (modelPgType === 'TEXT' && (dbNormalizedType.startsWith('VARCHAR') || dbNormalizedType.startsWith('CHAR'))) {
                            alterations.push({ type: 'TYPE', newType: 'TEXT', reason: `Safe upgrade from ${dbNormalizedType} to TEXT.` });
                        } else if (modelPgType === 'JSONB' && dbNormalizedType === 'JSON') {
                             alterations.push({ type: 'TYPE', newType: 'JSONB', reason: `Safe upgrade from JSON to JSONB.` });
                        } else if (modelPgType !== dbNormalizedType &&
                                 !(modelPgType.startsWith('VARCHAR') && dbNormalizedType.startsWith('VARCHAR') && modelPgType === dbNormalizedType) &&
                                 !(modelPgType === 'SERIAL' && dbNormalizedType === 'INTEGER')) {
                            console.warn(`  [${tableName}.${modelAttrDetails.name}] Type Mismatch: Model wants ${modelPgType}, DB has ${dbNormalizedType}. Manual review recommended. Skipping auto-alter for this type change.`);
                        }

                        const modelRequiresNotNull = modelAttr.required === true && modelAttr.defaultsTo === undefined && !(modelAttr.autoMigrations && modelAttr.autoMigrations.autoIncrement);
                        const dbIsNullable = existingDbCol.is_nullable === 'YES';

                        if (modelRequiresNotNull && dbIsNullable) {
                            alterations.push({ type: 'SET NOT NULL', reason: `Model requires NOT NULL.`});
                        } else if (!modelRequiresNotNull && !dbIsNullable) {
                            alterations.push({ type: 'DROP NOT NULL', reason: `Model allows NULL.`});
                        }

                        if (alterations.length > 0) {
                            columnsToModify.push({ name: modelAttrDetails.name, alterations: alterations });
                        }
                    }
                }

                if (columnsToAdd.length > 0) {
                    console.log(`  Columns to ADD to "${tableName}": ${columnsToAdd.map(c=>c.name).join(', ')}`);
                    for (const col of columnsToAdd) {
                        console.log(`    Adding column "${col.name}" (${col.pgType}) to "${tableName}"...`);
                        // FIX: THIS IS THE CRITICAL FIX FOR THE CRASH. Removed the semicolon.
                        await client.query(`ALTER TABLE "${tableName}" ADD COLUMN ${col.definition}`);
                        console.log(`    Column "${col.name}" added.`);
                    }
                }

                if (columnsToRemove.length > 0) {
                    console.warn(`  !!! WARNING: Columns to REMOVE (DROP) from "${tableName}": ${columnsToRemove.map(c=>c.column_name).join(', ')}`);
                    for (const col of columnsToRemove) {
                        console.warn(`    Removing (DROPPING) column "${col.column_name}" from "${tableName}"...`);
                        // FIX: Removed semicolon
                        await client.query(`ALTER TABLE "${tableName}" DROP COLUMN "${col.column_name}"`);
                        console.warn(`    Column "${col.column_name}" REMOVED (DROPPED).`);
                    }
                }

                if (columnsToModify.length > 0) {
                    console.log(`  Columns to MODIFY in "${tableName}":`);
                    for (const col of columnsToModify) {
                        console.log(`    Modifying column "${col.name}":`);
                        for (const alt of col.alterations) {
                            console.log(`      - Action: ${alt.type}, Reason: ${alt.reason}`);
                            if (alt.type === 'TYPE') {
                                // FIX: Removed semicolon
                                await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${col.name}" TYPE ${alt.newType} USING "${col.name}"::${alt.newType}`);
                                console.log(`        Column "${col.name}" type changed to ${alt.newType}.`);
                            } else if (alt.type === 'SET NOT NULL') {
                                // FIX: Removed semicolon
                                await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${col.name}" SET NOT NULL`);
                                 console.log(`        Column "${col.name}" set to NOT NULL.`);
                            } else if (alt.type === 'DROP NOT NULL') {
                                // FIX: Removed semicolon
                                await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${col.name}" DROP NOT NULL`);
                                console.log(`        Column "${col.name}" now allows NULL.`);
                            }
                        }
                    }
                }

                if (columnsToAdd.length === 0 && columnsToRemove.length === 0 && columnsToModify.length === 0) {
                    console.log(`  Table "${tableName}" schema is up to date with the model.`);
                }
            } else if (cleanDatabaseFirst && tableExists) {
                 console.log(`  Table "${tableName}" was just recreated (due to --CLEAN-DATABASE-I-AM-SURE). Skipping column diff.`);
            }


            console.log(`  Ensuring "updatedAt" trigger for "${tableName}"...`);
            // FIX: Removed semicolon
            await client.query(`DROP TRIGGER IF EXISTS "${tableName}_update_updated_at" ON "${tableName}"`);
            // FIX: Removed semicolon from end of create trigger query
            await client.query(`
                CREATE TRIGGER "${tableName}_update_updated_at"
                BEFORE UPDATE ON "${tableName}"
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column()
            `);
            console.log(`  "updatedAt" trigger ensured for "${tableName}".`);
        }

        console.log(`\nProcessing special table: "tests_isolated"`);
        const testTableName = 'tests_isolated';
        const testTableExistsRes = await client.query(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1);",
            [testTableName]
        );
        if (!testTableExistsRes.rows[0].exists) {
            const createTestTableQuery = `
                CREATE TABLE "${testTableName}" (
                    "id" SERIAL PRIMARY KEY,
                    "counter" VARCHAR(255),
                    "description" TEXT,
                    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `; // FIX: Removed semicolon
            await client.query(createTestTableQuery);
            console.log(`Table "${testTableName}" created.`);
        } else {
             console.log(`Table "${testTableName}" already exists or was just recreated.`);
        }


        console.log(`Ensuring "updatedAt" trigger for "${testTableName}"...`);
        // FIX: Removed semicolon
        await client.query(`DROP TRIGGER IF EXISTS "${testTableName}_update_updated_at" ON "${testTableName}"`);
        // FIX: Removed semicolon
        await client.query(`
            CREATE TRIGGER "${testTableName}_update_updated_at"
            BEFORE UPDATE ON "${testTableName}"
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        `);
        console.log(`"updatedAt" trigger ensured for "${testTableName}".`);


        await client.query('COMMIT');
        console.log("\n--- Schema Synchronization Complete. Transaction committed. ---");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("\nError during schema synchronization, transaction rolled back:", err);
        process.exit(1);
    } finally {
        console.log('Disconnecting from PostgreSQL...');
        client.release();
        await pool.end();
        console.log('Disconnected from PostgreSQL.');
    }
}

// ... (main function and its logic are correct, no changes needed there)
async function main() {
    const args = process.argv.slice(2);
    const cleanDatabaseFlag = '--CLEAN-DATABASE-I-AM-SURE';

    if (args.includes(cleanDatabaseFlag)) {
        console.warn("********************************************************************");
        console.warn("!!! EXTREME CAUTION: You have requested to clean the database.     !!!");
        console.warn("!!! This will DROP all tables defined in the models and            !!!");
        console.warn("!!! 'tests_isolated'. ALL DATA IN THESE TABLES WILL BE LOST.       !!!");
        console.warn("!!! THIS ACTION IS IRREVERSIBLE.                                   !!!");
        console.warn("********************************************************************");

        // Optional: Add a readline prompt for extra safety, especially for manual runs
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise(resolve => {
            rl.question(`Type 'YES-DROP-ALL-MY-DATA' to confirm database cleaning: `, resolve);
        });
        rl.close();

        if (answer === 'YES-DROP-ALL-MY-DATA') {
            console.log("Confirmation received. Proceeding with database cleaning and recreation.");
            await manageSchema(true);
        } else {
            console.log("Confirmation not received or incorrect. Aborting database cleaning.");
            console.log("To proceed with normal schema sync (no dropping), run without the flag.");
            process.exit(0);
        }
    } else {
        console.log("Running in schema synchronization mode (create/update tables).");
        console.log(`To clean and recreate the database from scratch, run with the ${cleanDatabaseFlag} flag.`);
        await manageSchema(false);
    }
}

main().catch(err => {
    console.error("Unhandled error in main execution:", err);
    process.exit(1);
});