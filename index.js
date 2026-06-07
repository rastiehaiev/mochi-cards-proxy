import fetch from 'node-fetch';

const MOCHI_BASE = 'https://app.mochi.cards/api';

const mochiRequest = async (path, method = 'GET', body = null) => {
  const token = Buffer.from(process.env.MOCHI_API_KEY + ':').toString('base64');
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + token
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${MOCHI_BASE}${path}`, options);
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
};

const handlers = {

  // POST /cards — create a single card
  // Body: { slides: string[], deckId: string }
  'POST /cards': async (body) => {
    const { slides, deckId } = body;
    if (!deckId) return { status: 400, data: { error: 'Missing field: deckId' } };
    if (!Array.isArray(slides) || slides.length === 0) {
      return { status: 400, data: { error: 'Missing field: slides (non-empty array)' } };
    }
    const result = await mochiRequest('/cards/', 'POST', {
      'content': slides.join('\n---\n'),
      'deck-id': deckId,
      'review-reverse?': true
    });
    if (!result.ok) return { status: result.status, data: { error: result.data } };
    return { status: 200, data: { success: true, cardId: result.data.id } };
  },

  // POST /cards/batch — create up to 10 cards sequentially
  // Body: { cards: { slides: string[] }[], deckId: string }
  'POST /cards/batch': async (body) => {
    const { cards, deckId } = body;
    if (!Array.isArray(cards) || !deckId) {
      return { status: 400, data: { error: 'Missing fields: cards (array), deckId' } };
    }
    if (cards.length > 10) {
      return { status: 400, data: { error: 'Maximum 10 cards per batch' } };
    }
    if (cards.length === 0) {
      return { status: 400, data: { error: 'cards array is empty' } };
    }
    const results = [];
    for (const card of cards) {
      const { slides } = card;
      if (!Array.isArray(slides) || slides.length === 0) {
        results.push({ success: false, error: 'Missing or empty slides array' });
        continue;
      }
      const result = await mochiRequest('/cards/', 'POST', {
        'content': slides.join('\n---\n'),
        'deck-id': deckId,
        'review-reverse?': true
      });
      if (!result.ok) results.push({ success: false, slide: slides[0], error: result.data });
      else results.push({ success: true, slide: slides[0], cardId: result.data.id });
    }
    const created = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    return { status: 200, data: { created, failed, results } };
  },

  // DELETE /cards — delete a card
  // Body: { cardId: string }
  'DELETE /cards': async (body) => {
    const { cardId } = body;
    if (!cardId) return { status: 400, data: { error: 'Missing field: cardId' } };
    const result = await mochiRequest(`/cards/${cardId}`, 'DELETE');
    if (!result.ok) return { status: result.status, data: { error: result.data } };
    return { status: 200, data: { success: true } };
  },

  // GET /cards — list cards
  // Query: { deckId?, limit?, bookmark? }
  'GET /cards': async (query) => {
    const params = new URLSearchParams();
    if (query.deckId) params.set('deck-id', query.deckId);
    if (query.limit) params.set('limit', query.limit);
    if (query.bookmark) params.set('bookmark', query.bookmark);
    const result = await mochiRequest(`/cards/?${params.toString()}`);
    if (!result.ok) return { status: result.status, data: { error: result.data } };
    return { status: 200, data: result.data };
  },

  // GET /decks — list all decks
  // Query: { bookmark? }
  'GET /decks': async (query) => {
    const params = new URLSearchParams();
    if (query.bookmark) params.set('bookmark', query.bookmark);
    const result = await mochiRequest(`/decks/?${params.toString()}`);
    if (!result.ok) return { status: result.status, data: { error: result.data } };
    return { status: 200, data: result.data };
  },

};

export const mochiProxy = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const clientKey = req.headers['x-api-key'];
  if (!clientKey || clientKey !== process.env.PROXY_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const path = (req.path || '/').replace(/\/$/, '') || '/';
  const route = `${req.method} ${path}`;
  const handler = handlers[route];

  if (!handler) {
    res.status(404).json({ error: `Unknown route: ${route}`, available: Object.keys(handlers) });
    return;
  }

  const input = req.method === 'GET' ? req.query : req.body;
  const result = await handler(input);
  res.status(result.status).json(result.data);
};
