const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DB_URL,
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Checking record_of_work table for missing columns...');

        const columns = ['strand', 'substrands', 'isdeleted']; // postgres lowercases
        for (const col of columns) {
            const res = await client.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'record_of_work' AND lower(column_name) = $1
            `, [col]);

            if (res.rows.length === 0) {
                const actualColName = col === 'isdeleted' ? 'isDeleted' : col;
                const colType = col === 'isdeleted' ? 'BOOLEAN DEFAULT false' : 'TEXT';
                await client.query(`ALTER TABLE "record_of_work" ADD COLUMN "${actualColName}" ${colType}`);
                console.log(`Added column "${actualColName}" (${colType}).`);
            } else {
                console.log(`Column "${col}" already exists — skipping.`);
            }
        }

        // Also backfill: any existing rows with NULL isDeleted should be set to false
        const updated = await client.query(`UPDATE "record_of_work" SET "isDeleted" = false WHERE "isDeleted" IS NULL`);
        console.log(`Backfilled ${updated.rowCount} rows with isDeleted = false.`);

        console.log('--- Migration Successful ---');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
