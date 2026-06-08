const express = require('express');
const router = express.Router();
const { get } = require('../db/database');

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const NEWSDATA_BASE = 'https://newsdata.io/api/1';

// GET /feed
router.get('/', async (req, res) => {
  const prefs = get('SELECT * FROM user_preferences WHERE user_id = ?', [req.session.user.id]);
  const categories = JSON.parse(prefs.selected_topics || '[]');
  const sources = JSON.parse(prefs.selected_sources || '[]');
  const country = prefs.selected_country || '';

  try {
    const params = new URLSearchParams({ apikey: NEWSDATA_API_KEY, language: 'en' });
    if (categories.length > 0) params.set('category', categories.slice(0, 5).join(','));
    if (sources.length > 0) {
      params.set('domainurl', sources.slice(0, 5).join(','));
    } else {
      params.set('prioritydomain', 'top');
    }
    if (country) params.set('country', country);

    const response = await fetch(`${NEWSDATA_BASE}/latest?${params}`);
    const data = await response.json();
    const articles = data.results || [];

    res.render('feed', { articles, error: null });
  } catch (err) {
    console.error('[Feed] Error fetching news:', err);
    res.render('feed', { articles: [], error: 'Failed to load news. Please try again.' });
  }
});

module.exports = router;
