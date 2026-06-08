const express = require('express');
const router = express.Router();
const { get, run } = require('../db/database');

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const NEWSDATA_BASE = 'https://newsdata.io/api/1';

const CATEGORIES = [
  'business', 'crime', 'domestic', 'education',
  'entertainment', 'environment', 'food', 'health',
  'lifestyle', 'other', 'politics', 'science',
  'sports', 'technology', 'top', 'tourism', 'world'
];

const COUNTRIES = [
  { code: 'us', name: 'United States' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'ca', name: 'Canada' },
  { code: 'au', name: 'Australia' },
  { code: 'in', name: 'India' },
  { code: 'ie', name: 'Ireland' },
  { code: 'nz', name: 'New Zealand' },
  { code: 'sg', name: 'Singapore' },
  { code: 'za', name: 'South Africa' },
  { code: 'ng', name: 'Nigeria' },
  { code: 'ke', name: 'Kenya' },
  { code: 'ph', name: 'Philippines' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
  { code: 'jp', name: 'Japan' },
  { code: 'br', name: 'Brazil' },
  { code: 'mx', name: 'Mexico' },
  { code: 'it', name: 'Italy' },
  { code: 'es', name: 'Spain' },
  { code: 'kr', name: 'South Korea' },
  { code: 'ae', name: 'UAE' },
  { code: 'sa', name: 'Saudi Arabia' }
];

// GET /onboarding — show the current step
router.get('/', (req, res) => {
  const prefs = get('SELECT * FROM user_preferences WHERE user_id = ?', [req.session.user.id]);
  if (prefs && prefs.has_completed_onboarding) return res.redirect('/feed');

  const step = parseInt(req.query.step) || 1;
  const sessionData = req.session.onboarding || {};

  res.render('onboarding', {
    step,
    countries: COUNTRIES,
    categories: CATEGORIES,
    selectedCountry: sessionData.country || '',
    selectedTopics: sessionData.topics || [],
    selectedSources: sessionData.sources || [],
    availableSources: sessionData.availableSources || [],
    error: null
  });
});

// POST /onboarding/country
router.post('/country', (req, res) => {
  const { country } = req.body;
  if (!req.session.onboarding) req.session.onboarding = {};
  req.session.onboarding.country = country;
  res.redirect('/onboarding?step=2');
});

// POST /onboarding/topics
router.post('/topics', (req, res) => {
  let { topics } = req.body;
  if (!topics) topics = [];
  if (typeof topics === 'string') topics = [topics];
  if (!req.session.onboarding) req.session.onboarding = {};
  req.session.onboarding.topics = topics;
  res.redirect('/onboarding?step=3');
});

// GET /onboarding/sources-data — fetch sources from NewsData API
router.get('/sources-data', async (req, res) => {
  const sessionData = req.session.onboarding || {};
  const topics = sessionData.topics || [];
  const country = sessionData.country || '';

  try {
    const params = new URLSearchParams({ apikey: NEWSDATA_API_KEY, language: 'en', prioritydomain: 'top' });
    if (topics.length > 0) params.set('category', topics.slice(0, 5).join(','));
    if (country) params.set('country', country);

    const response = await fetch(`${NEWSDATA_BASE}/sources?${params}`);
    const data = await response.json();
    const sources = (data.results || []).map(s => {
      let domain = '';
      try {
        const parsed = new URL(s.url || '');
        domain = parsed.hostname.replace(/^www\./, '');
      } catch { domain = s.id || ''; }
      return { id: s.id, name: s.name, domain };
    }).filter(s => s.domain);

    res.json(sources);
  } catch (err) {
    console.error('[Onboarding] Failed to fetch sources:', err);
    res.json([]);
  }
});

// POST /onboarding/sources
router.post('/sources', (req, res) => {
  let { sources } = req.body;
  if (!sources) sources = [];
  if (typeof sources === 'string') sources = [sources];
  if (!req.session.onboarding) req.session.onboarding = {};
  req.session.onboarding.sources = sources.slice(0, 4);
  res.redirect('/onboarding/finish');
});

// GET /onboarding/finish — save preferences and redirect
router.get('/finish', (req, res) => {
  const sessionData = req.session.onboarding || {};
  const userId = req.session.user.id;

  const existing = get('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);
  if (existing) {
    run('UPDATE user_preferences SET selected_country = ?, selected_topics = ?, selected_sources = ?, has_completed_onboarding = 1 WHERE user_id = ?', [
      sessionData.country || '',
      JSON.stringify(sessionData.topics || []),
      JSON.stringify(sessionData.sources || []),
      userId
    ]);
  } else {
    run('INSERT INTO user_preferences (user_id, selected_country, selected_topics, selected_sources, has_completed_onboarding) VALUES (?, ?, ?, ?, 1)', [
      userId,
      sessionData.country || '',
      JSON.stringify(sessionData.topics || []),
      JSON.stringify(sessionData.sources || [])
    ]);
  }

  delete req.session.onboarding;
  res.redirect('/feed');
});

module.exports = router;
