const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DB_URL,
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Synchronizing "amount" and "ammount" columns...');
        
        // 1. Move data from ammount to amount where amount is null
        await client.query('UPDATE "charge" SET "amount" = "ammount"::numeric WHERE "amount" IS NULL AND "ammount" IS NOT NULL');
        console.log('Merged data from "ammount" to "amount".');

        // 2. Drop the ammount column
        await client.query('ALTER TABLE "charge" DROP COLUMN IF EXISTS "ammount"');
        console.log('Dropped redundant "ammount" column.');

        // 3. Ensure amount is NOT NULL
        // First, set a default for any remaining nulls (if any)
        await client.query('UPDATE "charge" SET "amount" = 0 WHERE "amount" IS NULL');
        await client.query('ALTER TABLE "charge" ALTER COLUMN "amount" SET NOT NULL');
        console.log('Applied NOT NULL constraint to "amount".');

        // 4. Ensure term column exists
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'charge' AND column_name = 'term'
        `);
        if (res.rows.length === 0) {
            await client.query('ALTER TABLE "charge" ADD COLUMN "term" TEXT');
            console.log('Added missing "term" column.');
        } else {
            console.log('Column "term" already exists.');
        }

        console.log('--- Migration Successful ---');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
