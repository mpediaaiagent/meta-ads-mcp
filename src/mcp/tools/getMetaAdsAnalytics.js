import { z } from "zod";
import { config } from "../../config.js";
import { requestJson } from "../../lib/httpJson.js";

const TOOL_NAME = "get_meta_ads_analytics";

// Thin wrapper: no analytics logic here. It only calls this project's own API
// and hands the response back to Claude.
async function callMetaAdsAnalyticsApi(startDate, endDate) {
  const url = new URL("/api/meta-ads/analytics", config.apiBaseUrl);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);

  const response = await requestJson(url);
  const body = response.body;

  if (!response.ok) {
    throw new Error(body.message || `API request failed with status ${response.status}`);
  }

  return body;
}

export function registerGetMetaAdsAnalyticsTool(server) {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Get Meta Ads Analytics",
      description:
        "Get SQL-only TruBuddy marketing attribution analytics grouped by UTM campaign, " +
        "adset, ad, daily data, orders, and purchased items for a date range.",
      inputSchema: {
        start_date: z.string().min(1).describe("Start date in YYYY-MM-DD format"),
        end_date: z.string().min(1).describe("End date in YYYY-MM-DD format"),
      },
    },
    async ({ start_date: startDate, end_date: endDate }) => {
      try {
        const analytics = await callMetaAdsAnalyticsApi(startDate, endDate);
        return {
          content: [{ type: "text", text: JSON.stringify(analytics, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to get Meta Ads analytics: ${error.message}` }],
        };
      }
    }
  );
}
