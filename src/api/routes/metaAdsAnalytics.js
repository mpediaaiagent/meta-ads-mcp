import { Router } from "express";
import { resolveDateRange } from "../lib/dateRange.js";
import { getTrubuddyProductionAnalytics } from "../clients/trubuddyAnalyticsClient.js";

export const metaAdsAnalyticsRouter = Router();

// GET /api/meta-ads/analytics?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
//
// Thin bridge to the TruBuddy Laravel analytics endpoint.
metaAdsAnalyticsRouter.get("/", async (req, res) => {
  const { start_date: startDate, end_date: endDate } = req.query;

  const { range, error } = resolveDateRange(startDate, endDate);
  if (error) {
    return res.status(error.status).json(error.body);
  }

  try {
    const analytics = await getTrubuddyProductionAnalytics(range);
    return res.status(200).json(analytics);
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
