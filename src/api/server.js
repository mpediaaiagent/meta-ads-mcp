import express from "express";
import { config } from "../config.js";
import { metaAdsAnalyticsRouter } from "./routes/metaAdsAnalytics.js";

const app = express();

app.use("/api/meta-ads/analytics", metaAdsAnalyticsRouter);

app.listen(config.port, () => {
  console.log(`meta-ads-mcp API listening on http://localhost:${config.port}`);
});
