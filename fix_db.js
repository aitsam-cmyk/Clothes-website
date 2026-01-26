const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'clothes.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run("UPDATE products SET image_url = '/placeholder.svg' WHERE image_url LIKE '%via.placeholder%'", function(err) {
        if (err) console.error(err);
        else console.log(`Updated ${this.changes} rows.`);
    });
});
