const express = require('express');
const router = express.Router();
const { get } = require('../db/database');

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const NEWSDATA_BASE = 'https://newsdata.io/api/1';
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';

async function generateSummary(category, articles) {
  let prompt = `Summarize the following top news stories in ${capitalize(category)} into a single cohesive paragraph. ` +
    `Mention the news source for each story naturally in your writing (e.g., "According to BBC..." or "as reported by CNN"). ` +
    `Keep it concise but informative, covering the key developments. Do not use bullet points or numbered lists. ` +
    `Write as a single flowing paragraph.\n\nArticles:`;

  articles.forEach((article, i) => {
    const title = article.title || 'Untitled';
    const source = article.source_name || 'Unknown Source';
    const desc = article.description || '';
    prompt += `\n${i + 1}. ${title} (Source: ${source}) - ${desc}`;
  });

  const response = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  if (data.content && data.content[0] && data.content[0].text) {
    return data.content[0].text;
  }
  throw new Error('Empty response from Claude API');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function groupArticlesByCategory(articles, userCategories) {
  const categorySet = new Set(userCategories.map(c => c.toLowerCase()));
  const grouped = {};

  for (const article of articles) {
    const cats = article.category || [];
    const primary = cats[0];
    if (!primary) continue;
    const normalized = primary.toLowerCase();
    if (!categorySet.has(normalized)) continue;
    if (!grouped[normalized]) grouped[normalized] = [];
    if (grouped[normalized].length < 5) grouped[normalized].push(article);
  }

  return grouped;
}

// GET /summary
router.get('/', async (req, res) => {
  const prefs = get('SELECT * FROM user_preferences WHERE user_id = ?', [req.session.user.id]);
  const categories = JSON.parse(prefs.selected_topics || '[]');
  const sources = JSON.parse(prefs.selected_sources || '[]');
  const country = prefs.selected_country || '';

  try {
    // Fetch articles
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

    if (articles.length === 0) {
      return res.render('summary', { summaries: [], error: 'No articles found for your topics.' });
    }

    const grouped = groupArticlesByCategory(articles, categories);
    const summaries = [];

    for (const category of categories) {
      const normalized = category.toLowerCase();
      const catArticles = grouped[normalized];
      if (!catArticles || catArticles.length === 0) continue;

      try {
        const text = await generateSummary(normalized, catArticles);
        summaries.push({ category: normalized, text, articles: catArticles });
      } catch (err) {
        console.error(`[Summary] Failed for ${category}:`, err.message);
      }
    }

    res.render('summary', { summaries, error: null });
  } catch (err) {
    console.error('[Summary] Error:', err);
    res.render('summary', { summaries: [], error: 'Failed to generate summaries. Please try again.' });
  }
});

module.exports = router;
