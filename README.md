# meta-ads-mcp

A custom MCP server + API for Meta Ads analytics.

**Architecture rule:** the API is the source of truth, the MCP is only a bridge, and Claude is only
the conversation/explanation layer.

```
Claude -> our MCP -> our API -> local TruBuddy SQL marketing tables -> API response -> MCP -> Claude
```

This project does not include recommendations, Keep/Pause logic, Audience Catalog, budget/ad
automation, attribution, or profit calculation (shipping/product cost/payment fees/refunds are not
subtracted — revenue is gross order value). There is exactly one filter: date range.

This version returns SQL-only TruBuddy marketing attribution data grouped by campaign/adset/ad and
day. It does not read Athena and does not write to any TruBuddy table.

## Structure

```
src/
  config.js                          shared env config
  api/
    server.js                        Express API server entry point
    routes/
      metaAdsAnalytics.js            GET /api/meta-ads/analytics handler + validation
    services/
      analyticsService.js            aggregation logic: SQL marketing tables -> response shape
    clients/
      mysqlClient.js                 read-only MySQL pool (trubuddyweb sessions/events)
      productCatalog.js              reads local allProducts.json for product names
    lib/
      dateRange.js                   validates start_date/end_date, converts IST -> UTC
  mcp/
    server.js                        MCP server entry point
    tools/
      getMetaAdsAnalytics.js         get_meta_ads_analytics tool (thin wrapper over the API)
```

## Data sources (read-only, never written to)

- **MySQL** (`utms`, `sessions`, `events`, `purchases`) — trubuddyweb's local marketing analytics
  tables, joined by `session_id`. `DB_*` env vars point at the DB; every pooled connection
  is put into `SET SESSION TRANSACTION READ ONLY` as a safety net.
- **Product catalog** — read from this repo's local `src/api/data/allProducts.json` copy. Use
  `PRODUCT_CATALOG_PATH` only if you need to override that path.

## 1. Install dependencies

Requires Node.js 18 or newer.

```
npm install
```

## 2. Configure environment variables

```
cp .env.example .env
```

Fill in `DB_*` with real values (ask a teammate — never commit them).
For local development, `DB_HOST=127.0.0.1` etc. point at a local Laragon MySQL instance
that must be running (see trubuddyweb's own `.env` for the local dev DB name/credentials).

## 3. Run the API

```
npm start
```

This starts the Express API on `http://localhost:3000`.

### Test the API endpoint

```
curl "http://localhost:3000/api/meta-ads/analytics?start_date=2026-09-09&end_date=2026-09-15"
```

Response shape:

```json
{
  "date_range": { "start_date": "2026-09-01", "end_date": "2026-09-15", "timezone": "Asia/Kolkata" },
  "campaigns": [
    {
      "utm_campaign": "C1",
      "utm_adset": "A1C1",
      "utm_ad": "A1C1A1",
      "daily_data": [
        {
          "date": "15/09/26",
          "page_visits": 1,
          "engaged_sessions": 1,
          "add_to_carts": 1,
          "orders": [
            {
              "order_id": "order_123",
              "items": [
                {
                  "product_id": "1",
                  "product_name": "The Secret to Forming Habits",
                  "quantity": 1,
                  "unit_price": 179
                }
              ],
              "total_revenue": 228
            }
          ]
        }
      ]
    }
  ]
}
```

Field sources:

- `utm_campaign` = `utms.utm_campaign`
- `utm_adset` = `utms.utm_content`
- `utm_ad` = `utms.utm_term`
- `date` = `purchases.purchased_at` converted to Asia/Kolkata display date
- `page_visits` = `COUNT(DISTINCT sessions.session_id)`
- `engaged_sessions` = distinct sessions where `engaged_seconds > 10`
- `add_to_carts` = distinct `events.session_id` where `event_type = 'add_to_cart'`
- `orders`/`total_revenue` = `purchases.order_id` and `purchases.total_amount`
- `items` = parsed from `purchases.orderData.cartDetails`, with fallback to `purchases.cart`
- `product_name` = product ID lookup in `src/api/data/allProducts.json`

Missing/invalid dates, or `end_date` before `start_date`, return a `400` with a JSON error:

```
curl "http://localhost:3000/api/meta-ads/analytics?start_date=2026-09-01"
curl "http://localhost:3000/api/meta-ads/analytics?start_date=not-a-date&end_date=2026-09-15"
curl "http://localhost:3000/api/meta-ads/analytics?start_date=2026-09-15&end_date=2026-09-01"
```

### A note on local testing

The API reads the local SQL tables only. It does not query Athena or change Athena in any way.

## 4. Run the MCP server

The MCP server calls the local API, so keep the API running (step 3) in one terminal, then in
another terminal:

```
npm run mcp
```

The MCP server communicates over stdio, so it won't print anything when idle — it's waiting for an
MCP client (like Claude Desktop) to connect.

## 5. Configure Claude Desktop to use this MCP server

Add an entry to your Claude Desktop config file
(`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "meta-ads-mcp": {
      "command": "node",
      "args": ["C:\\IT Work\\meta-ads-mcp\\src\\mcp\\server.js"]
    }
  }
}
```

Restart Claude Desktop afterward. The API server must be running separately (step 3) for the tool
to return data.

## 6. Test the tool locally

With both the API and the MCP server running, and Claude Desktop configured as above:

1. Open Claude Desktop and confirm the `get_meta_ads_analytics` tool is listed for the
   `meta-ads-mcp` server.
2. Ask Claude something like: "Get Meta ads analytics from 2026-09-09 to 2026-09-15."
3. Claude calls `get_meta_ads_analytics` with `start_date` and `end_date`, which calls the local
   API, which reads the local SQL marketing tables, and returns it for Claude to explain.

You can also test the MCP server directly (without Claude Desktop) using the
[MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector):

```
npx @modelcontextprotocol/inspector node src/mcp/server.js
```

## Known issue in the upstream codebase (not this repo)

`trubuddyweb` has Firebase/Google service-account private keys hardcoded directly in ~30 PHP files
(not loaded from `.env`), including the one this project's `.env` reuses read-only. This should be
rotated and centralized in `trubuddyweb` independent of this project — flagged here so it isn't
lost.

## Phase 3 (not built yet)

Add Meta Marketing API calls for spend/impressions/clicks by campaign/adset/ad.
