# meta-ads-mcp

A custom MCP server + API for Meta Ads analytics. The MCP wraps the API; Claude calls the MCP tool,
the MCP calls the API, the API reads Meta data plus this project's own website/order data, and
returns a clean structured response for Claude to explain.

This is not a recommendation engine, Keep/Pause system, or attribution replacement — those live in
other repos. This project only surfaces analytics: UTM breakdowns, Meta campaign/adset/ad
breakdowns, website event counts, product/revenue breakdowns, a summary, an event funnel, and a
data-quality section.

## Status

Phase 1 (in progress): prove the full flow with mock data.
`get_meta_ads_analytics(start_date, end_date)` (MCP tool) → `GET /api/meta-ads/analytics` (API) →
mock response.

Phase 2 (later): replace mock data with real Meta API + DB/tracking data.

## Structure

```
src/
  index.js                     MCP server entry point
  server.js                    API server entry point (Express)
  config.js                    env config loader
  apiClient.js                 HTTP client the MCP tools use to call this project's own API
  tools/
    getMetaAdsAnalytics.js     MCP tool definition
  routes/
    analytics.js               GET /api/meta-ads/analytics handler
  data/
    mockAnalytics.js           Phase 1 mock analytics response
```

## Setup

```
npm install
cp .env.example .env
```
