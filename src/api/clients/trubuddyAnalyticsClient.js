import { config } from "../../config.js";
import { requestJson } from "../../lib/httpJson.js";

export async function getTrubuddyProductionAnalytics(range) {
  if (!config.trubuddyAnalytics.url) {
    const error = new Error("TRUBUDDY_ANALYTICS_URL is not configured.");
    error.status = 500;
    error.body = {
      error: "missing_trubuddy_analytics_url",
      message: "TRUBUDDY_ANALYTICS_URL must be configured.",
    };
    throw error;
  }

  const response = await requestJson(config.trubuddyAnalytics.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      start_date: range.startDate,
      end_date: range.endDate,
    }),
  });

  const body = response.body;

  if (!response.ok) {
    const message = body?.message || body?.error || `TruBuddy analytics API failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}
