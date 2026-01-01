const bcrypt = require('bcrypt');
const db = require('../database.js');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  console.log('Login attempt for:', username);

  const { rows } = await db.query(
    'SELECT id, username, password FROM admins WHERE username = $1',
    [username]
  );
  const admin = rows[0];

  if (!admin) {
    console.log('Login failed: User not found:', username);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, admin.password);
  if (!match) {
    console.log('Login failed: Password mismatch for:', username);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Prevent session fixation
  if (!req.session) {
    console.error('Critical Error: req.session is undefined in login handler');
    return res.status(500).json({ error: 'Server misconfiguration: No session' });
  }

  console.log('Regenerating session for user:', admin.username);
  req.session.regenerate((err) => {
    if (err) {
      console.error('Session regeneration failed:', err);
      return res.status(500).json({ error: 'Login failed: Session error' });
    }

    req.session.user = { id: admin.id, username: admin.username };
    console.log('Session regenerated successfully. User logged in:', admin.username);

    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('Session save failed:', saveErr);
        return res.status(500).json({ error: 'Login failed: Session save error' });
      }
      res.json({ message: 'Login successful' });
    });
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