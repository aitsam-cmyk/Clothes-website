const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://neondb_owner:npg_lNY8scVEgOC1@ep-morning-credit-a1gexsht-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false } // 'require' in string usually needs this in node pg unless certs are provided
});

async function initRemoteDb() {
    try {
        console.log('Connecting to Neon DB...');
        const client = await pool.connect();
        console.log('Connected!');

        const schemaPath = path.resolve(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running schema...');
        await client.query(schema);
        console.log('Schema applied successfully!');

        // Verify tables
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('Tables created:', res.rows.map(r => r.table_name).join(', '));

        client.release();
    } catch (err) {
        console.error('Error initializing DB:', err);
    } finally {
        await pool.end();
    }
}

initRemoteDb();