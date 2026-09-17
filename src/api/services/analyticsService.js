import { queryTrubuddyDb } from "../clients/mysqlClient.js";
import { lookupProduct } from "../clients/productCatalog.js";

function toMysqlDatetime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function round2(amount) {
  return Math.round(amount * 100) / 100;
}

function campaignKey(row) {
  return [row.utm_campaign || "", row.utm_adset || "", row.utm_ad || ""].join("\u0001");
}

function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeCartDetails(raw) {
  if (Array.isArray(raw)) return raw;

  const parsed = safeJsonParse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function normalizeCart(raw) {
  const parsed = safeJsonParse(raw);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function getProductName(productId) {
  return lookupProduct(String(productId)).productName;
}

function parsePurchaseItems(purchase) {
  const orderData = safeJsonParse(purchase.orderData) || {};
  const cartDetails = normalizeCartDetails(orderData.cartDetails);

  if (cartDetails.length > 0) {
    return cartDetails.map((item) => {
      const productId = String(item.id ?? item.product_id ?? item.productId);
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.price) || 0;

      return {
        product_id: productId,
        product_name: getProductName(productId),
        quantity,
        unit_price: round2(unitPrice),
      };
    });
  }

  const cart = normalizeCart(purchase.cart || orderData.cart);
  const entries = Object.entries(cart);
  const totalQuantity = entries.reduce((sum, [, quantity]) => sum + (Number(quantity) || 0), 0);
  const fallbackUnitPrice =
    totalQuantity > 0 ? Number(purchase.total_amount || orderData.total || 0) / totalQuantity : 0;

  return entries.map(([productId, quantity]) => ({
    product_id: String(productId),
    product_name: getProductName(productId),
    quantity: Number(quantity) || 0,
    unit_price: round2(fallbackUnitPrice),
  }));
}

function ensureCampaign(campaignsByKey, row) {
  const key = campaignKey(row);
  if (!campaignsByKey.has(key)) {
    campaignsByKey.set(key, {
      utm_campaign: row.utm_campaign || null,
      utm_adset: row.utm_adset || null,
      utm_ad: row.utm_ad || null,
      daily_data: [],
      dailyDataByDate: new Map(),
    });
  }

  return campaignsByKey.get(key);
}

function ensureDailyData(campaign, date) {
  if (!campaign.dailyDataByDate.has(date)) {
    const dailyData = {
      date,
      page_visits: 0,
      engaged_sessions: 0,
      add_to_carts: 0,
      orders: [],
    };

    campaign.dailyDataByDate.set(date, dailyData);
    campaign.daily_data.push(dailyData);
  }

  return campaign.dailyDataByDate.get(date);
}

function addMetricRows(campaignsByKey, rows, metricName) {
  for (const row of rows) {
    const campaign = campaignsByKey.get(campaignKey(row));
    if (!campaign) continue;

    const dailyData = campaign.dailyDataByDate.get(row.date);
    if (!dailyData) continue;

    dailyData[metricName] = Number(row[metricName]) || 0;
  }
}

function effectiveUtmSelect(eventTimeColumn) {
  return `
       COALESCE(
         NULLIF(u.utm_campaign, ''),
         (
           SELECT NULLIF(u2.utm_campaign, '')
           FROM utms u2
           WHERE u2.visitor_id = s.visitor_id
             AND (NULLIF(u2.utm_campaign, '') IS NOT NULL
               OR NULLIF(u2.utm_content, '') IS NOT NULL
               OR NULLIF(u2.utm_term, '') IS NOT NULL)
             AND u2.created_at <= ${eventTimeColumn}
           ORDER BY u2.created_at DESC, u2.id DESC
           LIMIT 1
         )
       ) AS utm_campaign,
       COALESCE(
         NULLIF(u.utm_content, ''),
         (
           SELECT NULLIF(u2.utm_content, '')
           FROM utms u2
           WHERE u2.visitor_id = s.visitor_id
             AND (NULLIF(u2.utm_campaign, '') IS NOT NULL
               OR NULLIF(u2.utm_content, '') IS NOT NULL
               OR NULLIF(u2.utm_term, '') IS NOT NULL)
             AND u2.created_at <= ${eventTimeColumn}
           ORDER BY u2.created_at DESC, u2.id DESC
           LIMIT 1
         )
       ) AS utm_adset,
       COALESCE(
         NULLIF(u.utm_term, ''),
         (
           SELECT NULLIF(u2.utm_term, '')
           FROM utms u2
           WHERE u2.visitor_id = s.visitor_id
             AND (NULLIF(u2.utm_campaign, '') IS NOT NULL
               OR NULLIF(u2.utm_content, '') IS NOT NULL
               OR NULLIF(u2.utm_term, '') IS NOT NULL)
             AND u2.created_at <= ${eventTimeColumn}
           ORDER BY u2.created_at DESC, u2.id DESC
           LIMIT 1
         )
       ) AS utm_ad`;
}

async function getSessionMetrics(range) {
  return queryTrubuddyDb(
    `SELECT
       attributed_sessions.utm_campaign,
       attributed_sessions.utm_adset,
       attributed_sessions.utm_ad,
       attributed_sessions.date,
       COUNT(DISTINCT attributed_sessions.session_id) AS page_visits,
       COUNT(DISTINCT CASE
         WHEN attributed_sessions.engaged_seconds > 10 THEN attributed_sessions.session_id
       END) AS engaged_sessions
     FROM (
       SELECT
         s.session_id,
         s.engaged_seconds,
         ${effectiveUtmSelect("s.started_at")},
         DATE_FORMAT(DATE_ADD(s.started_at, INTERVAL 330 MINUTE), '%d/%m/%y') AS date
       FROM sessions s
       LEFT JOIN utms u ON u.session_id = s.session_id
       WHERE s.started_at >= ? AND s.started_at < ?
     ) attributed_sessions
     GROUP BY
       attributed_sessions.utm_campaign,
       attributed_sessions.utm_adset,
       attributed_sessions.utm_ad,
       attributed_sessions.date`,
    [toMysqlDatetime(range.startUtc), toMysqlDatetime(range.endUtcExclusive)]
  );
}

async function getAddToCartMetrics(range) {
  return queryTrubuddyDb(
    `SELECT
       attributed_events.utm_campaign,
       attributed_events.utm_adset,
       attributed_events.utm_ad,
       attributed_events.date,
       COUNT(DISTINCT attributed_events.session_id) AS add_to_carts
     FROM (
       SELECT
         e.session_id,
         ${effectiveUtmSelect("e.created_at")},
         DATE_FORMAT(DATE_ADD(e.created_at, INTERVAL 330 MINUTE), '%d/%m/%y') AS date
       FROM events e
       INNER JOIN sessions s ON s.session_id = e.session_id
       LEFT JOIN utms u ON u.session_id = e.session_id
       WHERE e.event_type = 'add_to_cart'
         AND e.created_at >= ?
         AND e.created_at < ?
     ) attributed_events
     GROUP BY
       attributed_events.utm_campaign,
       attributed_events.utm_adset,
       attributed_events.utm_ad,
       attributed_events.date`,
    [toMysqlDatetime(range.startUtc), toMysqlDatetime(range.endUtcExclusive)]
  );
}

async function getPurchaseRows(range) {
  return queryTrubuddyDb(
    `SELECT
       ${effectiveUtmSelect("p.purchased_at")},
       DATE_FORMAT(DATE_ADD(p.purchased_at, INTERVAL 330 MINUTE), '%d/%m/%y') AS date,
       p.order_id,
       p.total_amount,
       p.orderData,
       p.cart
     FROM purchases p
     LEFT JOIN sessions s ON s.session_id = p.session_id
     LEFT JOIN utms u ON u.session_id = p.session_id
     WHERE p.purchased_at >= ? AND p.purchased_at < ?
     ORDER BY p.purchased_at ASC, p.id ASC`,
    [toMysqlDatetime(range.startUtc), toMysqlDatetime(range.endUtcExclusive)]
  );
}

export async function getMetaAdsWebsiteAnalytics(range) {
  const [sessionRows, addToCartRows, purchaseRows] = await Promise.all([
    getSessionMetrics(range),
    getAddToCartMetrics(range),
    getPurchaseRows(range),
  ]);

  const campaignsByKey = new Map();

  for (const purchase of purchaseRows) {
    const campaign = ensureCampaign(campaignsByKey, purchase);
    const dailyData = ensureDailyData(campaign, purchase.date);

    dailyData.orders.push({
      order_id: purchase.order_id,
      items: parsePurchaseItems(purchase),
      total_revenue: round2(Number(purchase.total_amount) || 0),
    });
  }

  addMetricRows(campaignsByKey, sessionRows, "page_visits");
  addMetricRows(campaignsByKey, sessionRows, "engaged_sessions");
  addMetricRows(campaignsByKey, addToCartRows, "add_to_carts");

  const campaigns = [...campaignsByKey.values()]
    .map((campaign) => {
      campaign.daily_data.sort((a, b) => a.date.localeCompare(b.date));
      delete campaign.dailyDataByDate;
      return campaign;
    })
    .sort((a, b) => {
      const campaignCompare = (a.utm_campaign || "").localeCompare(b.utm_campaign || "");
      if (campaignCompare !== 0) return campaignCompare;

      const adsetCompare = (a.utm_adset || "").localeCompare(b.utm_adset || "");
      if (adsetCompare !== 0) return adsetCompare;

      return (a.utm_ad || "").localeCompare(b.utm_ad || "");
    });

  return { campaigns };
}
