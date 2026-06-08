require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { getDb, get } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

// Make session user available to all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireOnboarding(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  const prefs = get('SELECT * FROM user_preferences WHERE user_id = ?', [req.session.user.id]);
  if (!prefs || !prefs.has_completed_onboarding) return res.redirect('/onboarding');
  next();
}

// Routes
const authRoutes = require('./routes/auth');
const onboardingRoutes = require('./routes/onboarding');
const feedRoutes = require('./routes/feed');
const summaryRoutes = require('./routes/summary');
const profileRoutes = require('./routes/profile');

app.use('/', authRoutes);
app.use('/onboarding', requireAuth, onboardingRoutes);
app.use('/feed', requireOnboarding, feedRoutes);
app.use('/summary', requireOnboarding, summaryRoutes);
app.use('/profile', requireOnboarding, profileRoutes);

// Home redirect
app.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const prefs = get('SELECT * FROM user_preferences WHERE user_id = ?', [req.session.user.id]);
  if (!prefs || !prefs.has_completed_onboarding) return res.redirect('/onboarding');
  res.redirect('/feed');
});

// Initialize DB then start server
getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`DawnCast running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
