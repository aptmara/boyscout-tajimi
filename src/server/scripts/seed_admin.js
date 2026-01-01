
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const db = require('../database.js');
const bcrypt = require('bcrypt');

async function seed() {
    try {
        console.log('Seeding Admin User...');
        // Ensure table exists (it should)

        const username = process.env.INITIAL_ADMIN_USERNAME || 'admin';
        const password = process.env.INITIAL_ADMIN_PASSWORD || 'password123';

        console.log(`Checking for user: ${username}`);
        const { rows } = await db.query('SELECT * FROM admins WHERE username = $1', [username]);

        if (rows.length > 0) {
            console.log('Admin user already exists.');
        } else {
            console.log('Creating admin user...');
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query('INSERT INTO admins (username, password) VALUES ($1, $2)', [username, hashedPassword]);
            console.log(`Admin user created successfully.`);
            console.log(`Username: ${username}`);
            console.log(`Password: ${password}`);
        }

    } catch (error) {
        console.error('Seeding Failed:', error);
    }
}

seed();
