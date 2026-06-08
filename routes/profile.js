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

// GET /profile
router.get('/', (req, res) => {
  const prefs = get('SELECT * FROM user_preferences WHERE user_id = ?', [req.session.user.id]);
  const selectedTopics = JSON.parse(prefs.selected_topics || '[]');
  const selectedSources = JSON.parse(prefs.selected_sources || '[]');
  const selectedCountry = prefs.selected_country || '';

  const countryName = COUNTRIES.find(c => c.code === selectedCountry)?.name || selectedCountry.toUpperCase();

  res.render('profile', {
    categories: CATEGORIES,
    countries: COUNTRIES,
    selectedTopics,
    selectedSources,
    selectedCountry,
    countryName,
    success: req.query.saved === '1' ? 'Preferences saved.' : null
  });
});

// POST /profile/update
router.post('/update', (req, res) => {
  let { country, topics, sources } = req.body;
  if (!topics) topics = [];
  if (typeof topics === 'string') topics = [topics];
  if (!sources) sources = [];
  if (typeof sources === 'string') sources = [sources];

  run('UPDATE user_preferences SET selected_country = ?, selected_topics = ?, selected_sources = ? WHERE user_id = ?', [
    country || '',
    JSON.stringify(topics),
    JSON.stringify(sources.slice(0, 4)),
    req.session.user.id
  ]);

  res.redirect('/profile?saved=1');
});

// GET /profile/sources-data — fetch sources for editing
router.get('/sources-data', async (req, res) => {
  const prefs = get('SELECT * FROM user_preferences WHERE user_id = ?', [req.session.user.id]);
  const topics = JSON.parse(prefs.selected_topics || '[]');
  const country = prefs.selected_country || '';

  // Allow overriding with query params (when topics change in the editor)
  const queryTopics = req.query.topics ? req.query.topics.split(',') : topics;
  const queryCountry = req.query.country || country;

  try {
    const params = new URLSearchParams({ apikey: NEWSDATA_API_KEY, language: 'en', prioritydomain: 'top' });
    if (queryTopics.length > 0) params.set('category', queryTopics.slice(0, 5).join(','));
    if (queryCountry) params.set('country', queryCountry);

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
    console.error('[Profile] Failed to fetch sources:', err);
    res.json([]);
  }
});

module.exports = router;
