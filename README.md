# mochi-cards-proxy

A lightweight Google Cloud Function that acts as a proxy to the [Mochi Cards API](https://mochi.cards/docs/api/). Solves the issue of Mochi's dashed field names (e.g. `deck-id`, `review-reverse?`) that break compatibility with tools like ChatGPT Actions or other clients that expect clean JSON.

## Why

Mochi's API uses non-standard field names in request bodies (`deck-id`, `review-reverse?`) which are incompatible with many API clients and AI tools. This proxy accepts clean, camelCase JSON and handles the translation internally.

## Endpoints

### Create a card
```
POST /cards
```
```json
{
  "deckId": "your-deck-id",
  "key": "la mesa",
  "value": "стіл"
}
```
```json
{ "success": true, "cardId": "abc123" }
```

---

### Delete a card
```
DELETE /cards
```
```json
{ "cardId": "abc123" }
```
```json
{ "success": true }
```

---

### List cards
```
GET /cards?deckId=your-deck-id&limit=20
```

| Param | Required | Description |
|---|---|---|
| `deckId` | no | Filter by deck |
| `limit` | no | Number of cards (1–100, default 10) |
| `bookmark` | no | Pagination cursor from previous response |

---

### List decks
```
GET /decks
```

| Param | Required | Description |
|---|---|---|
| `bookmark` | no | Pagination cursor from previous response |

---

## Deploy to Google Cloud Functions

### 1. Clone the repo

```bash
git clone https://github.com/your-username/mochi-cards-proxy
cd mochi-cards-proxy
```

### 2. Deploy

```bash
gcloud functions deploy mochi-proxy \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=mochiProxy \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars MOCHI_API_KEY=your-mochi-key,PROXY_API_KEY=your-proxy-secret
```

### 3. Test

```bash
# List decks
curl https://YOUR_FUNCTION_URL/decks

# List cards in a deck
curl "https://YOUR_FUNCTION_URL/cards?deckId=your-deck-id"

# Create a card
curl -X POST https://YOUR_FUNCTION_URL/cards \
  -H "Content-Type: application/json" \
  -d '{"deckId": "your-deck-id", "key": "la mesa", "value": "стіл"}'

# Delete a card
curl -X DELETE https://YOUR_FUNCTION_URL/cards \
  -H "Content-Type: application/json" \
  -d '{"cardId": "abc123"}'
```

## Local development

```bash
npm install
npx @google-cloud/functions-framework --target=mochiProxy
```

Then send requests to `http://localhost:8080`.

## Authentication

Every request must include an `X-API-Key` header:

```bash
curl https://YOUR_FUNCTION_URL/decks \
  -H "X-API-Key: your-proxy-secret"
```

Requests without a valid key return `401 Unauthorized`.

## Environment variables

| Variable | Description |
|---|---|
| `MOCHI_API_KEY` | Your Mochi API key from Settings → API |
| `PROXY_API_KEY` | Secret key clients must send in `X-API-Key` header |
