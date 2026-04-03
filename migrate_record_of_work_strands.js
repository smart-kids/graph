const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DB_URL,
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Adding strand/substrands columns to record_of_work table...');

        const columns = ['strand', 'substrands'];
        for (const col of columns) {
            const res = await client.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'record_of_work' AND column_name = $1
            `, [col]);

            if (res.rows.length === 0) {
                await client.query(`ALTER TABLE "record_of_work" ADD COLUMN "${col}" TEXT`);
                console.log(`Added column "${col}".`);
            } else {
                console.log(`Column "${col}" already exists — skipping.`);
            }
        }

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
