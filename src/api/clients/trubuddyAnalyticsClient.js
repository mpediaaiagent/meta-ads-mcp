import { config } from "../../config.js";

export async function getTrubuddyProductionAnalytics(range) {
  if (!config.trubuddyAnalytics.url) {
    return null;
  }

  const response = await fetch(config.trubuddyAnalytics.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.trubuddyAnalytics.secret
        ? { "X-META-ADS-MCP-SECRET": config.trubuddyAnalytics.secret }
        : {}),
    },
    body: JSON.stringify({
      start_date: range.startDate,
      end_date: range.endDate,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body?.message || body?.error || `TruBuddy analytics API failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}
