const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const configuredPath = process.env.DB_PATH ? process.env.DB_PATH : path.resolve(__dirname, 'clothes.db');
const dbPath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(__dirname, configuredPath);
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database ' + dbPath + ': ' + err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    try {
        const schemaPath = path.resolve(__dirname, 'schema_sqlite.sql');
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            // Split by semicolon but ignore newlines/empty
            const statements = schema.split(';').filter(stmt => stmt.trim() !== '');
            
            db.serialize(() => {
                statements.forEach(stmt => {
                    if (stmt.trim()) {
                        db.run(stmt, (err) => {
                            if (err) {
                                // Ignore error if table already exists (schema has IF NOT EXISTS)
                                // But log others
                                if (!err.message.includes('already exists')) {
                                    console.error('DB Init Error:', err.message);
                                }
                            }
                        });
                    }
                });
            });
            console.log('Database initialized with schema.');
        }
    } catch (error) {
        console.error('Failed to initialize database:', error);
    }
}

module.exports = db;
