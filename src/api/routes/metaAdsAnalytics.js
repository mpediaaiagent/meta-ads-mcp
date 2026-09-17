import { Router } from "express";
import { resolveDateRange } from "../lib/dateRange.js";
import { getTrubuddyProductionAnalytics } from "../clients/trubuddyAnalyticsClient.js";
import { getMetaAdsWebsiteAnalytics } from "../services/analyticsService.js";
import { config } from "../../config.js";

export const metaAdsAnalyticsRouter = Router();

// GET /api/meta-ads/analytics?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
//
// Returns SQL-only TruBuddy marketing attribution data grouped by
// campaign/adset/ad and daily purchase date.
metaAdsAnalyticsRouter.get("/", async (req, res) => {
  const { start_date: startDate, end_date: endDate } = req.query;

  const { range, error } = resolveDateRange(startDate, endDate);
  if (error) {
    return res.status(error.status).json(error.body);
  }

  try {
    const productionAnalytics = await getTrubuddyProductionAnalytics(range);
    if (productionAnalytics) {
      return res.status(200).json(productionAnalytics);
    }

    const analytics = await getMetaAdsWebsiteAnalytics(range);
    return res.status(200).json({
      date_range: {
        start_date: range.startDate,
        end_date: range.endDate,
        timezone: config.reportingTimezone,
      },
      ...analytics,
    });
  } catch (err) {
    console.error("Failed to build meta-ads analytics:", err);
    if (err.status && err.body) {
      return res.status(err.status).json(err.body);
    }

    return res.status(500).json({
      error: "internal_error",
      message: "Failed to build analytics for the requested date range.",
    });
  }
});
