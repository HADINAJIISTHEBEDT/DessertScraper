const SEARCH_TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS || 25000);
const JINA_TIMEOUT_MS = Number(process.env.JINA_TIMEOUT_MS || 20000);
const MIGROS_TIMEOUT_MS = Number(
  process.env.MIGROS_TIMEOUT_MS || Math.max(20000, SEARCH_TIMEOUT_MS),
);
const MARKET_RESULT_LIMIT = Number(process.env.MARKET_RESULT_LIMIT || 20);
const MIGROS_RESULT_LIMIT = Number(process.env.MIGROS_RESULT_LIMIT || MARKET_RESULT_LIMIT);
const MIGROS_ACCEPT_LANGUAGE = String(
  process.env.MIGROS_ACCEPT_LANGUAGE || "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
).trim();
const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

const MARKET_ORDER = ["sok", "migros", "file", "bim"];
const MARKET_LABELS = {
  sok: "Sok",
  migros: "Migros",
  file: "File",
  bim: "BIM",
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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function rankItemsForQuery(query, items, limit = MARKET_RESULT_LIMIT) {
  return dedupeItems(items)
    .map((item) => ({ item, score: itemMatchScore(query, item.name) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => (b.score - a.score) || (a.item.price - b.item.price))
    .slice(0, limit)
    .map(({ item }) => item);
}

function parsePriceValue(text) {
  const str = String(text || "");
  const match =
    str.match(/([\d]{1,3}(?:[.,]\d{3})*[.,]\d{1,2})\s*(?:₺|TL)/i) ||
    str.match(/(?:₺|TL)\s*([\d]{1,3}(?:[.,]\d{3})*[.,]\d{1,2})/i) ||
    str.match(/([\d]+[.,]\d{2})/);

  if (!match) return null;
  const parsed = Number.parseFloat(String(match[1]).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

async function fetchText(url, timeoutMs = SEARCH_TIMEOUT_MS, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": CHROME_USER_AGENT,
        Accept: "text/html,application/json,text/plain,*/*",
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

async function fetchJson(url, timeoutMs = SEARCH_TIMEOUT_MS, headers = {}) {
  const text = await fetchText(url, timeoutMs, headers);
  return JSON.parse(text);
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

function migrosApiHeaders(referer) {
  return {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": MIGROS_ACCEPT_LANGUAGE,
    Referer: referer,
    "X-Requested-With": "XMLHttpRequest",
  };
}

function mapMigrosApiItem(item) {
  const rawPrice = [
    item?.crmDiscountedSalePrice,
    item?.salePrice,
    item?.shownPrice,
    item?.regularPrice,
  ].find((value) => Number.isFinite(Number(value)) && Number(value) > 0);

  const price = Number.isFinite(Number(rawPrice)) ? Number(rawPrice) / 100 : null;
  if (!item?.name || !Number.isFinite(price) || price <= 0) return null;

  return {
    market: MARKET_LABELS.migros,
    name: normalizeText(item.name),
    price,
    image: normalizeText(
      item?.images?.[0]?.urls?.PRODUCT_LIST ||
        item?.images?.[0]?.urls?.PRODUCT_DETAIL ||
        item?.images?.[0]?.urls?.PRODUCT_HD ||
        "",
    ),
  };
}

async function fetchMigrosApiPage(query, page = 1) {
  const url =
    `https://www.migros.com.tr/rest/search/screens/products?q=${encodeURIComponent(query)}` +
    `&page=${page}`;
  const referer = `https://www.migros.com.tr/arama?q=${encodeURIComponent(query)}`;
  const payload = await fetchJson(url, MIGROS_TIMEOUT_MS, migrosApiHeaders(referer));
  const searchInfo = payload?.data?.searchInfo || {};
  const items = dedupeItems(
    (Array.isArray(searchInfo.storeProductInfos) ? searchInfo.storeProductInfos : [])
      .map(mapMigrosApiItem)
      .filter(Boolean),
  );

  return {
    items,
    pageCount: Math.max(1, Number(searchInfo.pageCount || 1)),
  };
}

async function scrapeMigros(query) {
  logScrape("Migros", `Starting fresh scrape for "${query}"`);
  const variants = queryVariants(query);
  const combined = [];
  const seen = new Set();

  for (const variant of variants) {
    try {
      let page = 1;
      let pageCount = 1;
      while (page <= pageCount && combined.length < MIGROS_RESULT_LIMIT) {
        const response = await fetchMigrosApiPage(variant, page);
        pageCount = response.pageCount;
        for (const item of response.items) {
          const key = `${item.name.toLowerCase()}|${item.price.toFixed(2)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          combined.push(item);
          if (combined.length >= MIGROS_RESULT_LIMIT) break;
        }
        page += 1;
      }
    } catch (error) {
      logScrape("Migros", `API error for "${variant}": ${error.message}`);
    }
  }

  if (combined.length) {
    return rankItemsForQuery(query, combined, MIGROS_RESULT_LIMIT);
  }

  const fallback = [];
  for (const variant of variants) {
    try {
      const text = await withTimeout(
        `Migros Jina fetch ${variant}`,
        fetchViaJinaReader(`https://www.migros.com.tr/arama?q=${encodeURIComponent(variant)}`),
        MIGROS_TIMEOUT_MS,
      );
      fallback.push(...parseMigrosFromSearchText(text));
    } catch (error) {
      logScrape("Migros", `Jina error for "${variant}": ${error.message}`);
    }
  }

  return rankItemsForQuery(query, fallback, MIGROS_RESULT_LIMIT);
}

function parseMigrosFromSearchText(text) {
  const items = [];
  const lines = String(text || "").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const imageMatch = lines[index].match(
      /\[!\[Image \d+: ([^\]]+?)\]\((https?:\/\/[^)]+)\)\]\((https?:\/\/www\.migros\.com\.tr\/[^)\s]+)\)/i,
    );
    if (!imageMatch) continue;

    let name = normalizeText(imageMatch[1]);
    let price = null;
    for (let lookAhead = index + 1; lookAhead < Math.min(index + 12, lines.length); lookAhead += 1) {
      const line = normalizeText(lines[lookAhead]);
      if (!line) continue;
      const heading = line.match(/^# \[([^\]]+)\]/);
      if (heading) name = normalizeText(heading[1]);
      if (price === null) price = parsePriceValue(line);
    }

    if (!name || !price) continue;
    items.push({
      market: MARKET_LABELS.migros,
      name,
      price,
      image: normalizeText(imageMatch[2]),
    });
  }

  return dedupeItems(items);
}

async function scrapeSok(query) {
  logScrape("Sok", `Starting fresh scrape for "${query}"`);
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

function parseBimFromMarkdown(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => normalizeText(line))
    .filter(Boolean);

  const items = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith("## ")) continue;

    const brand = normalizeText(lines[index].replace(/^## /, ""));
    const productLine = normalizeText((lines[index + 1] || "").replace(/^## /, ""));
    const bulletLine = normalizeText(lines[index + 2] || "");
    const block = [brand, productLine, bulletLine, lines[index + 3] || "", lines[index + 4] || ""].join(" ");
    const price = parsePriceValue(block);
    if (!productLine || !price) continue;

    const nameParts = [];
    if (brand && brand.toLowerCase() !== productLine.toLowerCase()) nameParts.push(brand);
    nameParts.push(productLine);
    if (bulletLine.startsWith("*")) nameParts.push(bulletLine.replace(/^\*\s*•?\s*/, ""));

    items.push({
      market: MARKET_LABELS.bim,
      name: normalizeText(nameParts.join(" ")),
      price,
      image: "",
    });
  }

  return dedupeItems(items);
}

async function scrapeBim(query) {
  logScrape("BIM", `Starting fresh scrape for "${query}"`);
  const sources = [
    "https://www.bim.com.tr/Categories/100/aktuel-urunler.aspx",
    "https://www.bim.com.tr/Categories/254/aktuel_urunler.aspx",
  ];

  const items = [];
  for (const url of sources) {
    try {
      const text = await withTimeout(`BIM Jina fetch ${url}`, fetchViaJinaReader(url));
      items.push(...parseBimFromMarkdown(text));
    } catch (error) {
      logScrape("BIM", `Official page error: ${error.message}`);
    }
  }

  if (items.length) return rankItemsForQuery(query, items, MARKET_RESULT_LIMIT);
  return await searchEngineFallback(query, "bim.com.tr", MARKET_LABELS.bim);
}

function stripHtml(text) {
  return String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDuckDuckGoResults(html, marketLabel) {
  const items = [];
  const resultPattern = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = resultPattern.exec(String(html || ""))) !== null) {
    const title = stripHtml(match[2]);
    const snippet = stripHtml(match[3]);
    const price = parsePriceValue(snippet);
    if (!title || !price) continue;
    items.push({
      market: marketLabel,
      name: normalizeText(title.replace(/\s*[-|].*$/, "")),
      price,
      image: "",
    });
  }

  return dedupeItems(items);
}

async function searchEngineFallback(query, domain, marketLabel) {
  const variants = queryVariants(query);
  const items = [];

  for (const variant of variants) {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${variant} site:${domain}`)}`;
      const html = await fetchText(url, SEARCH_TIMEOUT_MS, {
        "Content-Type": "application/x-www-form-urlencoded",
      });
      items.push(...parseDuckDuckGoResults(html, marketLabel));
    } catch (error) {
      logScrape(marketLabel, `search fallback error: ${error.message}`);
    }
  }

  return rankItemsForQuery(query, items, MARKET_RESULT_LIMIT);
}

async function scrapeFile(query) {
  logScrape("File", `Starting fresh scrape for "${query}"`);
  return await searchEngineFallback(query, "file.com.tr", MARKET_LABELS.file);
}

const MARKET_HANDLERS = {
  sok: scrapeSok,
  migros: scrapeMigros,
  file: scrapeFile,
  bim: scrapeBim,
};

async function searchProduct(product, market) {
  const normalizedMarket = String(market || "").trim().toLowerCase();
  const handler = MARKET_HANDLERS[normalizedMarket];
  if (!handler) return [];
  return await withTimeout(
    `searchProduct ${normalizedMarket}:${product}`,
    handler(product),
    normalizedMarket === "migros" ? Math.max(MIGROS_TIMEOUT_MS, SEARCH_TIMEOUT_MS) : SEARCH_TIMEOUT_MS,
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
  const totals = Object.fromEntries(MARKET_ORDER.map((market) => [market, 0]));

  for (const ingredient of Array.isArray(ingredients) ? ingredients : []) {
    const name = normalizeText(ingredient?.name);
    const quantity = Number(ingredient?.quantity || 0);
    const marketNames = ingredient?.marketNames && typeof ingredient.marketNames === "object"
      ? ingredient.marketNames
      : {};
    if (!name || quantity <= 0) continue;

    const searches = await Promise.all(
      MARKET_ORDER.map(async (market) => {
        const marketQuery = normalizeText(marketNames[market] || name);
        const result = await searchProduct(marketQuery, market).catch(() => []);
        return [market, Array.isArray(result) && result.length ? result[0] : null, marketQuery];
      }),
    );

    const row = {
      ingredient: name,
      quantity,
      marketNames: {},
    };

    for (const [market, item, marketQuery] of searches) {
      const unitPrice = item ? Number(item.price) : null;
      const cost = unitPrice !== null && Number.isFinite(unitPrice) ? unitPrice * quantity : null;
      row.marketNames[market] = marketQuery;
      row[market] = {
        name: item?.name || marketQuery,
        unitPrice,
        cost,
      };
      if (cost !== null) totals[market] += cost;
    }

    rows.push(row);
  }

  const availableTotals = MARKET_ORDER
    .filter((market) => rows.some((row) => row[market]?.unitPrice !== null))
    .map((market) => ({ name: MARKET_LABELS[market], total: totals[market] }));

  let cheapestMarket = "N/A";
  let cheapestTotal = null;
  if (availableTotals.length) {
    availableTotals.sort((a, b) => a.total - b.total);
    cheapestMarket = availableTotals[0].name;
    cheapestTotal = availableTotals[0].total;
  }

  return { rows, totals, cheapestMarket, cheapestTotal };
}

module.exports = {
  compareIngredients,
  searchProduct,
  searchMultiple,
};
