const express = require('express');
const csurf = require('csurf');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const http = require('http');
const path = require('path');

const viewRoutes = require('./src/server/routes/view.routes');
const db = require('./src/server/database');

const app = express();
app.set('views', './src/views');
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layouts/main');

app.use(cookieParser('secret'));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: false }));
app.use(express.urlencoded({ extended: true }));

// Mock helpers
const helpers = require('./src/server/utils/template-helpers.js');
app.locals.helpers = helpers;

const csrfProtection = csurf();

// Mock DB
db.pool = {
    query: async (sql, params) => {
        if (sql.includes('SELECT * FROM news')) {
            return {
                rows: [{
                    id: 10,
                    title: 'Test News',
                    content: 'Content',
                    created_at: new Date(),
                    category: 'news',
                    tags: ['tag1'],
                    image_urls: []
                }]
            };
        }
        if (sql.includes('SELECT * FROM activities')) {
            return {
                rows: [{
                    id: 10,
                    title: 'Test Activity',
                    content: 'Content',
                    created_at: new Date(),
                    category: 'activity',
                    tags: [],
                    image_urls: []
                }]
            };
        }
        return { rows: [] };
    }
};

// Mock middleware chain
app.use('/', (req, res, next) => {
    res.locals.siteConfig = {
        get: () => '',
        getImage: () => 'https://via.placeholder.com'
    };
    res.locals.user = null;
    next();
}, csrfProtection, (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
}, viewRoutes);

// Error handler to capture stack trace
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err);
    res.status(500).send(err.stack);
});

const PORT = 3004;
const server = app.listen(PORT, () => {
    console.log(`Test server running on ${PORT}`);

    http.get(`http://localhost:${PORT}/news/10`, (res) => {
        console.log(`GET /news/10 Status: ${res.statusCode}`);
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (res.statusCode === 500) {
                console.log('Reproduced 500 on /news/10');
                console.log('Response Body:', data);
            } else {
                console.log('Success: /news/10 returned', res.statusCode);
            }
            server.close();
        });
    });
});
