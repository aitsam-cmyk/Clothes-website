const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'clothes.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run("UPDATE products SET image_url = '/placeholder.svg' WHERE image_url LIKE 'https://via.placeholder.com%'", function(err) {
        if (err) {
            console.error(err.message);
        } else {
            console.log(`Updated ${this.changes} rows.`);
        }
        db.close();
    });
});
