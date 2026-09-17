import { readFileSync } from "node:fs";
import { config } from "../../config.js";

// Loaded once and cached: allProducts.json is a flat object keyed by product ID
// (individual book IDs like "1", and bundle IDs like "set8", "setOfAllBooks").
let catalog = null;

function loadCatalog() {
  if (!catalog) {
    const raw = readFileSync(config.productCatalogPath, "utf8");
    catalog = JSON.parse(raw);
  }
  return catalog;
}

// There is no separate SKU field in the catalog, so the product ID doubles as the SKU.
export function lookupProduct(productId) {
  const products = loadCatalog();
  const entry = products[productId];

  if (!entry) {
    return {
      productId: String(productId),
      sku: String(productId),
      productName: `Unknown Product ${productId}`,
      foundInCatalog: false,
    };
  }

  return {
    productId: String(productId),
    sku: String(productId),
    productName: entry.title,
    foundInCatalog: true,
  };
}
