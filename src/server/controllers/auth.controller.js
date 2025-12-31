const bcrypt = require('bcrypt');
const db = require('../database.js');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const { rows } = await db.query(
    'SELECT id, username, password FROM admins WHERE username = $1',
    [username]
  );
  const admin = rows[0];
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, admin.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  // Prevent session fixation
  if (!req.session) {
    console.error('Critical Error: req.session is undefined in login handler');
    return res.status(500).json({ error: 'Server misconfiguration: No session' });
  }

  req.session.regenerate((err) => {
    if (err) {
      console.error('Session regeneration failed:', err);
      // Fallback: If regeneration fails (e.g. file lock), try to proceed or just error out.
      // For security, checking if we can just set user.
      // return res.status(500).json({ error: 'Login failed due to server error' });
    }

    // Even if regeneration failed, we might want to proceed but log it.
    // However, failing open is bad for fixation. 
    // If it's a file locking issue on dev (sqlite), retrying might help?
    if (err) return res.status(500).json({ error: 'Login failed: Session error' });

    req.session.user = { id: admin.id, username: admin.username };
    res.json({ message: 'Login successful' });
  });
});

const logout = asyncHandler(async (req, res) => {
  await new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return reject(new Error('Could not log out'));
      }
      resolve();
    });
  });
  res.clearCookie('connect.sid');
  res.json({ message: 'Logout successful' });
});

const getSession = (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user });
  }
  return res.json({ loggedIn: false });
};

module.exports = {
  login,
  logout,
  getSession,
};