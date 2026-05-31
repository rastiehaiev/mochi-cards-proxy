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

  // POST /cards — create a card
  'POST /cards': async (body) => {
    const { key, value, deckId } = body;
    if (!key || !value || !deckId) {
      return { status: 400, data: { error: 'Missing fields: key, value, deckId' } };
    }
    const result = await mochiRequest('/cards/', 'POST', {
      'content': `${key}\n---\n${value}`,
      'deck-id': deckId,
      'review-reverse?': true
    });
    if (!result.ok) return { status: result.status, data: { error: result.data } };
    return { status: 200, data: { success: true, cardId: result.data.id } };
  },

  // DELETE /cards — delete a card
  'DELETE /cards': async (body) => {
    const { cardId } = body;
    if (!cardId) {
      return { status: 400, data: { error: 'Missing field: cardId' } };
    }
    const result = await mochiRequest(`/cards/${cardId}`, 'DELETE');
    if (!result.ok) return { status: result.status, data: { error: result.data } };
    return { status: 200, data: { success: true } };
  },

  // GET /cards — list cards (optionally filtered by deckId)
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
