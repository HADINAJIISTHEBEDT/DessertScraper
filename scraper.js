const SEARCH_TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS || 25000);
const JINA_TIMEOUT_MS = Number(process.env.JINA_TIMEOUT_MS || 20000);
const MARKET_RESULT_LIMIT = Number(process.env.MARKET_RESULT_LIMIT || 20);
const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

const MARKET_ORDER = ["sok"];
const MARKET_LABELS = {
  sok: "Sok",
};

function logScrape(stage, message) {
  console.log(`[Scraper][${stage}] ${message}`);
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

function transliterateTurkish(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[ıİ]/g, "i")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[\u0300-\u036f]/g, "");
}

function improveSearchQuery(query) {
  return normalizeText(String(query || ""))
    .toLowerCase()
    .replace(/\bmilk\b/g, "süt")
    .replace(/\bcheese\b/g, "peynir")
    .replace(/\byogurt\b/g, "yoğurt")
    .replace(/\bsut\b/g, "süt")
    .replace(/\bkasar\b/g, "kaşar")
    .replace(/\bcilek\b/g, "çilek");
}

function queryVariants(query) {
  const base = improveSearchQuery(query);
  const variants = new Set([base, transliterateTurkish(base)]);

  if (base.includes("süt")) variants.add(base.replaceAll("süt", "sut"));
  if (base.includes("yoğurt")) variants.add(base.replaceAll("yoğurt", "yogurt"));
  if (base.includes("çilek")) variants.add(base.replaceAll("çilek", "cilek"));
  if (base.includes("kaşar")) variants.add(base.replaceAll("kaşar", "kasar"));

  return [...variants].map(normalizeText).filter(Boolean);
}

function tokenize(text) {
  return transliterateTurkish(normalizeText(text).toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function itemMatchScore(query, itemName) {
  const queryTokens = tokenize(query);
  const itemTokens = tokenize(itemName);
  if (!queryTokens.length || !itemTokens.length) return 0;

  const itemSet = new Set(itemTokens);
  let score = 0;
  for (const token of queryTokens) {
    if (itemSet.has(token)) score += 3;
    else if (itemTokens.some((itemToken) => itemToken.includes(token) || token.includes(itemToken))) score += 1;
  }

  if (transliterateTurkish(itemName).includes(transliterateTurkish(query))) score += 4;
  return score;
}

function dedupeItems(items) {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const name = normalizeText(item?.name);
    const price = Number(item?.price);
    const image = normalizeText(item?.image);
    const market = normalizeText(item?.market);
    if (!name || !Number.isFinite(price) || price <= 0 || price > 50000) continue;

    const key = `${name.toLowerCase()}|${price.toFixed(2)}`;
    if (!map.has(key)) map.set(key, { market, name, price, image });
    else if (!map.get(key).image && image) map.set(key, { market, name, price, image });
  }
  return [...map.values()];
}

function rankItemsForQuery(query, items, limit = MARKET_RESULT_LIMIT) {
  return dedupeItems(items)
    .map((item) => ({ item, score: itemMatchScore(query, item.name) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => (b.score - a.score) || (a.item.price - b.item.price))
    .slice(0, limit)
    .map(({ item }) => item);
}

async function fetchText(url, timeoutMs = SEARCH_TIMEOUT_MS, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": CHROME_USER_AGENT,
        Accept: "text/plain,*/*",
        ...headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchViaJinaReader(url, timeoutMs = JINA_TIMEOUT_MS) {
  return await fetchText(`https://r.jina.ai/${url}`, timeoutMs, {
    Accept: "text/plain",
  });
}

function parseSokFromJinaText(text) {
  const items = [];
  const pattern =
    /\[!\[Image \d+: product-thumb\]\((https?:\/\/[^)]+)\)[^\]]*## ([^\]]+?)\s+(\d+,\d+)₺[^\]]*\]/g;

  let match;
  while ((match = pattern.exec(String(text || ""))) !== null) {
    items.push({
      market: MARKET_LABELS.sok,
      name: normalizeText(match[2]),
      price: Number.parseFloat(match[3].replace(",", ".")),
      image: normalizeText(match[1]),
    });
  }

  return dedupeItems(items);
}

async function scrapeSok(query) {
  logScrape("Sok", `Starting scrape for "${query}"`);
  const variants = queryVariants(query);
  const items = [];

  for (const variant of variants) {
    try {
      const text = await withTimeout(
        `Sok Jina fetch ${variant}`,
        fetchViaJinaReader(`https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(variant)}`),
      );
      if (/attention required|cloudflare|blocked/i.test(text)) continue;
      items.push(...parseSokFromJinaText(text));
    } catch (error) {
      logScrape("Sok", `Jina error for "${variant}": ${error.message}`);
    }
  }

  return rankItemsForQuery(query, items, MARKET_RESULT_LIMIT);
}

const MARKET_HANDLERS = {
  sok: scrapeSok,
};

async function searchProduct(product, market) {
  const normalizedMarket = String(market || "").trim().toLowerCase();
  const handler = MARKET_HANDLERS[normalizedMarket];
  if (!handler) return [];
  return await withTimeout(
    `searchProduct ${normalizedMarket}:${product}`,
    handler(product),
    SEARCH_TIMEOUT_MS,
  );
}

async function searchMultiple(product) {
  const entries = await Promise.all(
    MARKET_ORDER.map(async (market) => {
      const items = await searchProduct(product, market).catch((error) => {
        logScrape(MARKET_LABELS[market], error.message);
        return [];
      });
      return [market, Array.isArray(items) ? items : []];
    }),
  );

  return Object.fromEntries(entries);
}

async function compareIngredients(ingredients) {
  const rows = [];
  const totals = { sok: 0 };

  for (const ingredient of Array.isArray(ingredients) ? ingredients : []) {
    const name = normalizeText(ingredient?.name);
    const quantity = Number(ingredient?.quantity || 0);
    const marketNames = ingredient?.marketNames && typeof ingredient.marketNames === "object"
      ? ingredient.marketNames
      : {};
    if (!name || quantity <= 0) continue;

    const marketQuery = normalizeText(marketNames.sok || name);
    const result = await searchProduct(marketQuery, "sok").catch(() => []);
    const item = Array.isArray(result) && result.length ? result[0] : null;
    const unitPrice = item ? Number(item.price) : null;
    const cost = unitPrice !== null && Number.isFinite(unitPrice) ? unitPrice * quantity : null;
    if (cost !== null) totals.sok += cost;

    rows.push({
      ingredient: name,
      quantity,
      marketNames: { sok: marketQuery },
      sok: {
        name: item?.name || marketQuery,
        unitPrice,
        cost,
      },
    });
  }

  const hasSok = rows.some((row) => row.sok?.unitPrice !== null);
  return {
    rows,
    totals,
    cheapestMarket: hasSok ? "Sok" : "N/A",
    cheapestTotal: hasSok ? totals.sok : null,
  };
}

module.exports = {
  compareIngredients,
  searchProduct,
  searchMultiple,
};
