
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('./database.js');

async function test() {
    try {
        console.log('Testing DB Access...');
        // We need to setup or at least get client.
        // database.js doesn't export the db instance for sqlite directly, but 'query' function.
        // It initializes sqlite on load if environment matches.

        // Wait a bit for sqlite open if async (it is sync in database.js usually but query is async)

        const { rows } = await db.query('SELECT 1 as val');
        console.log('Connection successful. Result:', rows);

        const { rows: tableRows } = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='admins'");
        console.log('Admins table exists:', tableRows);

        if (tableRows.length > 0) {
            const { rows: admins } = await db.query('SELECT id, username FROM admins');
            console.log('Admins:', admins);
        } else {
            console.log('Admins table DOES NOT exist.');
        }

    } catch (error) {
        console.error('DB Test Failed:', error);
    }
}

test();
