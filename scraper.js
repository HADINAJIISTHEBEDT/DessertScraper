const SEARCH_TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS || 25000);
const JINA_TIMEOUT_MS = Number(process.env.JINA_TIMEOUT_MS || 20000);
const MIGROS_TIMEOUT_MS = Number(
  process.env.MIGROS_TIMEOUT_MS || Math.max(20000, SEARCH_TIMEOUT_MS),
);
const MIGROS_RESULT_LIMIT = Number(process.env.MIGROS_RESULT_LIMIT || 20);
const MIGROS_ACCEPT_LANGUAGE = String(
  process.env.MIGROS_ACCEPT_LANGUAGE || "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
).trim();
const MIGROS_REFERER = String(
  process.env.MIGROS_REFERER || "https://www.migros.com.tr/arama?q=sut",
).trim();
const MIGROS_DEBUG =
  String(process.env.MIGROS_DEBUG || "").trim() === "1";

const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

function logScrape(stage, message) {
  console.log(`[Scraper][${stage}] ${message}`);
}

function logMigrosDebug(message, extra) {
  if (!MIGROS_DEBUG) return;
  console.log(`[Migros][Debug] ${message}`, extra || "");
}

async function withTimeout(label, promise, timeoutMs = SEARCH_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function improveSearchQuery(query) {
  return String(query || "")
    .toLowerCase()
    .trim()
    .replace(/\bmilk\b/g, "süt")
    .replace(/\bcheese\b/g, "peynir")
    .replace(/\byogurt\b/g, "yoğurt")
    .replace(/\bsut\b/g, "süt")
    .replace(/\bkasar\b/g, "kaşar")
    .replace(/\bcilek\b/g, "çilek");
}

function migrosQueryVariants(query) {
  const raw = String(query || "").toLowerCase().trim();
  const improved = improveSearchQuery(query);
  const variants = new Set([raw, improved]);

  if (raw.includes("süt")) variants.add(raw.replaceAll("süt", "sut"));
  if (improved.includes("süt")) variants.add(improved.replaceAll("süt", "sut"));
  if (raw.includes("yoğurt")) variants.add(raw.replaceAll("yoğurt", "yogurt"));
  if (raw.includes("çilek")) variants.add(raw.replaceAll("çilek", "cilek"));
  if (raw.includes("kaşar")) variants.add(raw.replaceAll("kaşar", "kasar"));

  return [...variants].filter(Boolean);
}

function parsePriceValue(text) {
  if (!text) return null;
  const str = String(text);
  const match =
    str.match(/([\d]{1,3}(?:[.,]\d{3})*[.,]\d{1,2})\s*(?:\u20BA|TL)/i) ||
    str.match(/(?:\u20BA|TL)\s*([\d]{1,3}(?:[.,]\d{3})*[.,]\d{1,2})/i) ||
    str.match(/([\d]+[.,]\d{2})/);

  if (!match) return null;

  const parsed = Number.parseFloat(
    String(match[1]).replace(/\./g, "").replace(",", "."),
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function dedupeItems(items) {
  const map = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const name = normalizeText(item.name);
    const price = Number(item.price);
    const image = normalizeText(item.image);

    if (!name || name.length < 2) continue;
    if (!Number.isFinite(price) || price <= 0 || price > 5000) continue;

    const key = `${name.toLowerCase()}|${price.toFixed(2)}`;
    if (!map.has(key)) {
      map.set(key, { market: item.market, name, price, image });
    } else if (!map.get(key).image && image) {
      map.set(key, { market: item.market, name, price, image });
    }
  }

  return [...map.values()];
}

async function fetchViaJinaReader(url) {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);

  try {
    const response = await fetch(jinaUrl, {
      headers: {
        Accept: "text/plain",
        "User-Agent": CHROME_USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Jina reader HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseSokFromJinaText(text) {
  const out = [];
  const seen = new Set();
  const productPattern =
    /\[!\[Image \d+: product-thumb\]\((https?:\/\/[^)]+)\)[^\]]*## ([^\]]+?)\s+(\d+,\d+)\u20BA[^\]]*\]/g;

  let match;
  while ((match = productPattern.exec(text)) !== null) {
    const imageUrl = match[1];
    const fullName = match[2].trim();
    const price = Number.parseFloat(match[3].replace(",", "."));

    if (!Number.isFinite(price) || price <= 0 || price > 5000) continue;
    if (fullName.length < 3) continue;

    const key = `${fullName.toLowerCase()}|${price.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      market: "Sok",
      name: normalizeText(fullName),
      price,
      image: imageUrl,
    });
  }

  return dedupeItems(out);
}

function parseMigrosFromJinaText(text) {
  const normalized = String(text || "");
  if (!normalized) return [];

  const items = [];
  const seen = new Set();
  const lines = normalized.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const imageMatch = lines[i].match(
      /\[!\[Image \d+: ([^\]]+?)\]\((https?:\/\/[^)]+)\)\]\((https?:\/\/www\.migros\.com\.tr\/[^)\s]+-p-[a-z0-9]+)\)/i,
    );
    if (!imageMatch) continue;

    const fallbackName = normalizeText(imageMatch[1]);
    const image = normalizeText(imageMatch[2]);

    let name = fallbackName;
    let price = null;

    for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
      const line = normalizeText(lines[j]);
      if (!line) continue;

      const nameMatch = line.match(/^# \[([^\]]+)\]/);
      if (nameMatch) {
        name = normalizeText(nameMatch[1]);
      }

      if (price === null) {
        const parsed = parsePriceValue(line);
        if (parsed) {
          price = parsed;
          break;
        }
      }
    }

    if (!name || !price) continue;

    const key = `${name.toLowerCase()}|${price.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ market: "Migros", name, price, image });
  }

  const deduped = dedupeItems(items);
  logMigrosDebug("jina parser", { count: deduped.length, first: deduped[0] || null });
  return deduped;
}

function migrosApiHeaders(referer) {
  return {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": MIGROS_ACCEPT_LANGUAGE,
    Referer: referer || MIGROS_REFERER,
    "User-Agent": CHROME_USER_AGENT,
    "X-Requested-With": "XMLHttpRequest",
  };
}

function mapMigrosApiItem(item) {
  const priceCandidates = [
    item?.crmDiscountedSalePrice,
    item?.salePrice,
    item?.shownPrice,
    item?.regularPrice,
  ];
  const rawPrice = priceCandidates.find(
    (value) => Number.isFinite(Number(value)) && Number(value) > 0,
  );
  const price = Number.isFinite(Number(rawPrice)) ? Number(rawPrice) / 100 : null;
  const image = normalizeText(
    item?.images?.[0]?.urls?.PRODUCT_LIST ||
      item?.images?.[0]?.urls?.PRODUCT_DETAIL ||
      item?.images?.[0]?.urls?.PRODUCT_HD ||
      "",
  );

  if (!item?.name || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  return {
    market: "Migros",
    name: normalizeText(item.name),
    price,
    image,
  };
}

async function fetchMigrosApiPage(query, page = 1) {
  const targetUrl =
    `https://www.migros.com.tr/rest/search/screens/products?q=${encodeURIComponent(query)}` +
    `&page=${page}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MIGROS_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl, {
      headers: migrosApiHeaders(`https://www.migros.com.tr/arama?q=${encodeURIComponent(query)}`),
      signal: controller.signal,
    });

    logMigrosDebug("api fetch response", {
      query,
      page,
      status: response.status,
      ok: response.ok,
      finalUrl: response.url,
    });

    if (!response.ok) {
      throw new Error(`migros api HTTP ${response.status}`);
    }

    const payload = await response.json();
    const searchInfo = payload?.data?.searchInfo || {};
    const items = dedupeItems(
      (Array.isArray(searchInfo.storeProductInfos) ? searchInfo.storeProductInfos : [])
        .map(mapMigrosApiItem)
        .filter(Boolean),
    );

    return {
      items,
      pageCount: Number(searchInfo.pageCount || 1),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchMigrosApiResults(query, limit = MIGROS_RESULT_LIMIT) {
  const results = [];
  const seen = new Set();
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount && results.length < limit) {
    const response = await fetchMigrosApiPage(query, page);
    pageCount = Math.max(1, response.pageCount || 1);

    for (const item of response.items) {
      const key = `${item.name.toLowerCase()}|${Number(item.price).toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(item);
      if (results.length >= limit) break;
    }

    page += 1;
  }

  return results.slice(0, limit);
}

async function scrapeSok(product) {
  const query = improveSearchQuery(product);
  const variants = [query];

  if (query.includes("sut")) variants.push(query.replace("sut", "süt"));
  if (query.includes("cilek")) variants.push(query.replace("cilek", "çilek"));
  if (query.includes("kasar")) variants.push(query.replace("kasar", "kaşar"));

  for (const q of variants) {
    try {
      logScrape("Sok", `Trying Jina for query "${q}"`);
      const url = `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(q)}`;
      const text = await withTimeout("Sok Jina fetch", fetchViaJinaReader(url));
      if (/attention required|cloudflare|blocked/i.test(text)) continue;

      const items = parseSokFromJinaText(text);
      if (items.length > 0) {
        logScrape("Sok", `Found ${items.length} items for "${q}"`);
        return items;
      }
    } catch (err) {
      logScrape("Sok", `Jina error for "${q}": ${err.message}`);
    }
  }

  logScrape("Sok", `No results for "${product}"`);
  return [];
}

async function scrapeMigros(product) {
  const queries = migrosQueryVariants(product);
  logScrape("Migros", `Starting scrape for "${product}"`);

  for (const query of queries) {
    try {
      const items = await fetchMigrosApiResults(query, MIGROS_RESULT_LIMIT);
      if (items.length > 0) {
        logScrape("Migros", `API returned ${items.length} items for "${query}"`);
        return items;
      }
    } catch (err) {
      logScrape("Migros", `API error for "${query}": ${err.message}`);
    }
  }

  for (const query of queries) {
    try {
      logScrape("Migros", `Trying Jina for query "${query}"`);
      const url = `https://www.migros.com.tr/arama?q=${encodeURIComponent(query)}`;
      const text = await withTimeout(
        "Migros Jina fetch",
        fetchViaJinaReader(url),
        MIGROS_TIMEOUT_MS,
      );
      const items = parseMigrosFromJinaText(text);
      if (items.length > 0) {
        logScrape("Migros", `Jina returned ${items.length} items for "${query}"`);
        return items.slice(0, MIGROS_RESULT_LIMIT);
      }
    } catch (err) {
      logScrape("Migros", `Jina error for "${query}": ${err.message}`);
    }
  }

  return [];
}

async function compareIngredients(ingredients) {
  const rows = [];
  let sokTotal = 0;
  let migrosTotal = 0;

  for (const ing of ingredients) {
    const name = String(ing.name || "").trim();
    const marketNames =
      ing.marketNames && typeof ing.marketNames === "object" ? ing.marketNames : {};
    const sokName = String(marketNames.sok || name).trim();
    const migrosName = String(marketNames.migros || name).trim();
    const quantity = Number(ing.quantity || 0);
    if (!name || quantity <= 0) continue;

    const [sokItems, migrosItems] = await Promise.all([
      scrapeSok(sokName).catch(() => []),
      scrapeMigros(migrosName).catch(() => []),
    ]);

    const sokItem = Array.isArray(sokItems) && sokItems.length > 0 ? sokItems[0] : null;
    const migrosItem = Array.isArray(migrosItems) && migrosItems.length > 0 ? migrosItems[0] : null;

    const sokUnit = sokItem ? Number(sokItem.price) : null;
    const migrosUnit = migrosItem ? Number(migrosItem.price) : null;

    const sokCost =
      sokUnit !== null && Number.isFinite(sokUnit) ? sokUnit * quantity : null;
    const migrosCost =
      migrosUnit !== null && Number.isFinite(migrosUnit) ? migrosUnit * quantity : null;

    if (sokCost !== null) sokTotal += sokCost;
    if (migrosCost !== null) migrosTotal += migrosCost;

    rows.push({
      ingredient: name,
      quantity,
      marketNames: {
        sok: sokName,
        migros: migrosName,
      },
      sok: { unitPrice: sokUnit, cost: sokCost },
      migros: { unitPrice: migrosUnit, cost: migrosCost },
    });
  }

  const totals = { sok: sokTotal, migros: migrosTotal };
  const hasSok = rows.some((row) => row.sok.unitPrice !== null);
  const hasMigros = rows.some((row) => row.migros.unitPrice !== null);

  let cheapestMarket = "N/A";
  let cheapestTotal = null;
  const markets = [];

  if (hasSok) markets.push({ name: "Sok", total: sokTotal });
  if (hasMigros) markets.push({ name: "Migros", total: migrosTotal });

  if (markets.length > 0) {
    markets.sort((a, b) => a.total - b.total);
    cheapestMarket = markets[0].name;
    cheapestTotal = markets[0].total;
  }

  return { rows, totals, cheapestMarket, cheapestTotal };
}

async function searchProduct(product, market) {
  if (market === "sok") {
    return await withTimeout(`searchProduct sok:${product}`, scrapeSok(product));
  }
  if (market === "migros") {
    return await withTimeout(
      `searchProduct migros:${product}`,
      scrapeMigros(product),
      MIGROS_TIMEOUT_MS,
    );
  }
  return [];
}

async function searchMultiple(product) {
  const [sok, migros] = await Promise.all([
    withTimeout(`searchMultiple sok:${product}`, scrapeSok(product)).catch((err) => {
      logScrape("Sok", err.message);
      return [];
    }),
    withTimeout(
      `searchMultiple migros:${product}`,
      scrapeMigros(product),
      MIGROS_TIMEOUT_MS,
    ).catch((err) => {
      logScrape("Migros", err.message);
      return [];
    }),
  ]);

  return {
    sok: Array.isArray(sok) ? sok : [],
    migros: Array.isArray(migros) ? migros : [],
  };
}

module.exports = {
  compareIngredients,
  searchProduct,
  searchMultiple,
};
