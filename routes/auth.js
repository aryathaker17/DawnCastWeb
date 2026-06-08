const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { get, run } = require('../db/database');

const SALT_ROUNDS = 10;

// GET /login
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null });
});

// POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const trimmedEmail = email.toLowerCase().trim();

  const user = get('SELECT * FROM users WHERE email = ?', [trimmedEmail]);
  if (!user) {
    return res.render('login', { error: 'No account found with that email.' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.render('login', { error: 'Incorrect password.' });
  }

  req.session.user = { id: user.id, firstName: user.first_name, lastName: user.last_name, email: user.email };
  res.redirect('/');
});

// GET /signup
router.get('/signup', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('signup', { error: null });
});

// POST /signup
router.post('/signup', async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;
  const trimmedEmail = email.toLowerCase().trim();

  // Validation
  if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
    return res.render('signup', { error: 'Please enter a valid email address.' });
  }
  if (password.length < 6) {
    return res.render('signup', { error: 'Password must be at least 6 characters.' });
  }
  if (password !== confirmPassword) {
    return res.render('signup', { error: 'Passwords do not match.' });
  }

  // Check approved emails
  const approved = get('SELECT * FROM approved_emails WHERE email = ?', [trimmedEmail]);
  if (!approved) {
    return res.render('signup', { error: 'This email is not authorized to create an account.' });
  }

  // Check if already registered
  const existing = get('SELECT * FROM users WHERE email = ?', [trimmedEmail]);
  if (existing) {
    return res.render('signup', { error: 'An account with that email already exists.' });
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = run('INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)', [
    firstName.trim(),
    lastName.trim(),
    trimmedEmail,
    hash
  ]);

  req.session.user = { id: result.lastInsertRowid, firstName: firstName.trim(), lastName: lastName.trim(), email: trimmedEmail };
  res.redirect('/onboarding');
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
