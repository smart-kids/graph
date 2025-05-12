const Waterline = require('waterline');
const sailsPostgres = require('sails-postgresql');

// Initialize Waterline instance
const waterline = new Waterline();

// --- Configuration ---
const dbUrl = 'postgres://peafowl:uA7_pL5_uS4+oW1+bA3_@europe-west1-001.proxy.kinsta.app:30277/cooperative-cyan-halibut';
const tableName = 'tests_isolated'; // Use a unique name for this test to avoid conflicts

console.log(`Attempting to connect to: ${dbUrl}`);
console.log(`Will try to create/use table: ${tableName}`);

// --- Define the model ---
const TestModel = Waterline.Collection.extend({
  identity: tableName, // Use the dynamic table name
  datastore: 'default', // Use a named datastore
  primaryKey: 'id',
  attributes: {
    id: {
      type: 'number',
      autoMigrations: {
        autoIncrement: true, // PostgreSQL will handle auto-incrementing
        primaryKey: true,
        unique: true,
        // columnType: 'SERIAL' // Adapter usually handles this, but can be explicit
      }
    },
    counter: {
      type: 'string'
    },
    description: { // Added another field for a slightly more complex table
      type: 'string',
      allowNull: true
    }
    // Waterline automatically adds createdAt and updatedAt
  }
});

// Register model
waterline.registerModel(TestModel);

// --- Waterline config ---
const config = {
  adapters: {
    postgres: sailsPostgres
  },
  datastores: {
    default: { // Named datastore
      adapter: 'postgres',
      url: dbUrl,
      // CRITICAL FOR TABLE CREATION/MODIFICATION:
      // 'alter': Will attempt to create tables if they don't exist,
      //          and alter them if they do but schema differs.
      //          Use with caution in production (prefer 'safe' and manual migrations).
      // 'drop':  Will drop and recreate tables on every startup. DANGEROUS.
      // 'safe':  Assumes tables exist and match the schema. Will not create or alter.
      migrate: 'alter'
    }
  },
  defaultModelSettings: {
    datastore: 'default', // Ensure models use the 'default' datastore unless overridden
    // You could also put primaryKey settings here if all your models share them
    // For this test, defining it in the model is clear enough.
  }
};

console.log("Initializing Waterline...");

waterline.initialize(config, async (err, ontology) => {
  if (err) {
    console.error("WATERLINE INITIALIZATION FAILED:", err);
    process.exit(1); // Exit with an error code
    return;
  }

  console.log('Waterline initialized successfully!');
  console.log(`Migration strategy was: ${config.datastores.default.migrate}`);
  console.log(`Check your PostgreSQL database now for a table named '${tableName}'.`);

  // Tease out the fully initialized model collection
  const TestCollection = ontology.collections[tableName];

  if (!TestCollection) {
    console.error(`ERROR: Collection '${tableName}' not found in ontology.collections. This should not happen if initialization was successful.`);
    process.exit(1);
    return;
  }

  console.log(`\nAttempting operations on '${tableName}' collection...`);

  try {
    // 1. Create a record
    console.log('Attempting to create a record...');
    const newRecord = await TestCollection.create({
      counter: "1",
      description: "First test record"
    }).fetch(); // .fetch() returns the created record
    console.log('Record created successfully:', newRecord);

    // 2. Count records
    console.log('Attempting to count records...');
    const count = await TestCollection.count();
    console.log(`Current record count in '${tableName}': ${count}`);
    if (count > 0) {
      console.log("SUCCESS: Table exists and records can be created and counted.");
    } else {
      console.warn("WARN: Count is 0, which is unexpected after a create. Check creation logic or DB.");
    }

    // 3. Find a record (optional, good test)
    console.log('Attempting to find the created record...');
    const foundRecord = await TestCollection.findOne({ id: newRecord.id });
    if (foundRecord) {
      console.log('Record found successfully:', foundRecord);
    } else {
      console.warn(`WARN: Could not find record with id ${newRecord.id}`);
    }

    // Optional: Clean up by destroying the record or table
    // For this test, we'll leave it so you can inspect the DB.
    // To clean up:
    // await TestCollection.destroyOne({ id: newRecord.id });
    // console.log('Test record destroyed.');
    // If you used migrate: 'drop', the table would be gone on next run.

  } catch (opError) {
    console.error(`ERROR DURING DATABASE OPERATIONS on '${tableName}':`, opError);
    if (opError.message && opError.message.includes(`relation "${tableName}" does not exist`)) {
        console.error(`FAILURE: The table '${tableName}' was NOT created by Waterline, or there's a configuration mismatch.`);
    }
    process.exit(1); // Exit with an error code
  } finally {
    // In a real app, you wouldn't typically exit here, but for a test script,
    // it's useful to ensure it terminates, as DB connections can keep Node alive.
    console.log("\nTest script finished.");
    process.exit(0); // Exit successfully
  }
});