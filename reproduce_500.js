const express = require('express');
const csurf = require('csurf');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const db = require('./src/server/database');

// Mock specific siteConfig middleware to test isolately or use real one?
// Let's use real one but mock DB query inside it if possible, or assume DB is reachable.
const { loadSiteSettings } = require('./src/server/middleware/siteConfig.middleware');
const viewRoutes = require('./src/server/routes/view.routes');

const app = express();
app.set('views', './src/views');
app.set('view engine', 'ejs');
// Need layouts
const expressLayouts = require('express-ejs-layouts');
app.use(expressLayouts);
app.set('layout', 'layouts/main');

app.use(cookieParser('secret'));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: false }));
app.use(express.urlencoded({ extended: true })); // necessary for form
const csrfProtection = csurf(); // uses session by default

// Simulate the logic in server.js
app.use('/', loadSiteSettings, csrfProtection, (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
}, viewRoutes);

// Mock DB query (very crude override for testing purposes if real DB fails)
// But we have local sqlite, so it should work.

async function start() {
    console.log('Starting test server...');
    if (db.useSqlite) {
        await db.setupDatabase();
    }
    app.listen(3000, () => {
        console.log('Test server listening on 3000');
    });
}
start();
