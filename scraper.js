const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const puppeteerCore = require("puppeteer");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const NAV_TIMEOUT_MS = 60000;
const SEARCH_TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS || 25000);
const JINA_TIMEOUT_MS = Number(process.env.JINA_TIMEOUT_MS || 20000);
const MIGROS_TIMEOUT_MS = Number(
  process.env.MIGROS_TIMEOUT_MS || Math.max(45000, SEARCH_TIMEOUT_MS),
);
const MIGROS_RESULT_LIMIT = Number(process.env.MIGROS_RESULT_LIMIT || 20);
const MIGROS_ACCEPT_LANGUAGE = String(
  process.env.MIGROS_ACCEPT_LANGUAGE || "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
).trim();
const MIGROS_REFERER = String(
  process.env.MIGROS_REFERER || "https://www.migros.com.tr/arama?q=sut",
).trim();
const MIGROS_DEBUG =
  String(process.env.MIGROS_DEBUG || process.env.CARREFOUR_DEBUG || "").trim() ===
  "1";

const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function logScrape(stage, message) {
  console.log(`[Scraper][${stage}] ${message}`);
}

function logMigrosDebug(message, extra) {
  if (!MIGROS_DEBUG) return;
  console.log(`[Migros][Debug] ${message}`, extra || "");
}

function resolveChromeExecutablePath() {
  const explicit =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    process.env.GOOGLE_CHROME_BIN ||
    "";
  if (explicit && fs.existsSync(explicit)) return explicit;

  try {
    if (typeof puppeteerCore.executablePath === "function") {
      const detected = puppeteerCore.executablePath();
      if (detected && fs.existsSync(detected)) return detected;
    }
  } catch (_) {}

  return null;
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
    .replace(/\bmilk\b/g, "s\u00fct")
    .replace(/\bcheese\b/g, "peynir")
    .replace(/\byogurt\b/g, "yo\u011furt")
    .replace(/\bsut\b/g, "s\u00fct")
    .replace(/\bkasar\b/g, "ka\u015far")
    .replace(/\bcilek\b/g, "\u00e7ilek");
}

function migrosQueryVariants(query) {
  const raw = String(query || "").toLowerCase().trim();
  const improved = improveSearchQuery(query);
  const variants = new Set([raw, improved]);

  if (raw.includes("s\u00fct")) variants.add(raw.replaceAll("s\u00fct", "sut"));
  if (raw.includes("yo\u011furt")) variants.add(raw.replaceAll("yo\u011furt", "yogurt"));
  if (raw.includes("\u00e7ilek")) variants.add(raw.replaceAll("\u00e7ilek", "cilek"));
  if (raw.includes("ka\u015far")) variants.add(raw.replaceAll("ka\u015far", "kasar"));

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
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractItemsFromUnknownJson(input, market = "Migros") {
  const out = [];
  const queue = [input];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    const name = normalizeText(
      current.name ||
        current.productName ||
        current.displayName ||
        current.title ||
        current.shortName,
    );
    const price =
      parsePriceValue(
        current.price ||
          current.formattedPrice ||
          current.salePrice ||
          current.discountedPrice ||
          current.finalPrice ||
          current.priceText,
      ) ||
      Number(
        current.priceValue ||
          current.salePriceValue ||
          current.discountedPriceValue,
      );
    const image = normalizeText(
      current.image ||
        current.imageUrl ||
        current.imageURL ||
        current.thumbnail ||
        current.thumbnailUrl,
    );

    if (name && Number.isFinite(price) && price > 0) {
      out.push({ market, name, price, image });
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === "object") queue.push(value);
    }
  }

  return dedupeItems(out);
}

function parseMigrosHtml(html) {
  const normalizedHtml = String(html || "");
  if (!normalizedHtml) return [];

  if (/attention required|cloudflare|captcha|security check|blocked/i.test(normalizedHtml)) {
    return [];
  }

  const items = [];
  const ldJsonPattern =
    /<script[^>]*type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = ldJsonPattern.exec(normalizedHtml)) !== null) {
    try {
      items.push(...extractItemsFromUnknownJson(JSON.parse(decodeHtmlEntities(match[1]))));
    } catch (_) {}
  }

  const nextDataMatch = normalizedHtml.match(
    /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (nextDataMatch?.[1]) {
    try {
      items.push(
        ...extractItemsFromUnknownJson(
          JSON.parse(decodeHtmlEntities(nextDataMatch[1])),
        ),
      );
    } catch (_) {}
  }

  return dedupeItems(items);
}

async function extractMigrosItemsFromPage(page) {
  let previousHeight = 0;
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(1200);
    const height = await page.evaluate(() => document.body.scrollHeight);
    if (height === previousHeight) break;
    previousHeight = height;
  }

  const items = await page.evaluate(() => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const parsePrice = (text) => {
      const str = String(text || "");
      const match =
        str.match(/([\d]{1,3}(?:[.,]\d{3})*[.,]\d{1,2})\s*(?:\u20BA|TL)/i) ||
        str.match(/(?:\u20BA|TL)\s*([\d]{1,3}(?:[.,]\d{3})*[.,]\d{1,2})/i) ||
        str.match(/([\d]+[.,]\d{2})/);
      if (!match) return null;
      return Number.parseFloat(String(match[1]).replace(/\./g, "").replace(",", "."));
    };

    const cards = Array.from(
      new Set([
        ...document.querySelectorAll("fe-product-card"),
        ...document.querySelectorAll("mat-card"),
        ...document.querySelectorAll('[class*="product-card"]'),
      ]),
    );
    const out = [];
    const seen = new Set();
    const links = cards;

    const findContainer = (node) => {
      let current = node;
      for (let i = 0; i < 8 && current; i++) {
        const text = normalize(current.innerText || "");
        if (text && /(?:₺|TL)/i.test(text)) return current;
        current = current.parentElement;
      }
      return node;
    };

    links.forEach((link) => {
      const card = findContainer(link);
      const rawText = normalize(card.innerText || "");
      if (!rawText) return;

      const name =
        normalize(card.querySelector("h1, h2, h3, h4")?.textContent) ||
        normalize(link.getAttribute("title")) ||
        normalize(link.querySelector("img")?.getAttribute("alt")) ||
        normalize(rawText.split("\n")[0]);
      const price = parsePrice(rawText);
      if (!name || !Number.isFinite(price) || price <= 0 || price > 5000) return;

      const image =
        card.querySelector("img")?.currentSrc ||
        card.querySelector("img")?.src ||
        link.querySelector("img")?.currentSrc ||
        link.querySelector("img")?.src ||
        "";
      const key = `${name.toLowerCase()}|${price.toFixed(2)}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ market: "Migros", name, price, image });
    });

    return out;
  });

  return dedupeItems(items);
}

function migrosRequestHeaders(referer) {
  return {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": MIGROS_ACCEPT_LANGUAGE,
    "Cache-Control": "max-age=0",
    Origin: "https://www.migros.com.tr",
    Pragma: "no-cache",
    Priority: "u=0, i",
    Referer: referer || MIGROS_REFERER,
    "Sec-CH-UA":
      '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": CHROME_USER_AGENT,
  };
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
      hitCount: Number(searchInfo.hitCount || items.length),
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

async function fetchMigrosHtml(query) {
  const targetUrl = `https://www.migros.com.tr/arama?q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MIGROS_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl, {
      headers: migrosRequestHeaders(targetUrl),
      signal: controller.signal,
    });

    logMigrosDebug("direct fetch response", {
      query,
      status: response.status,
      ok: response.ok,
      redirected: response.redirected,
      finalUrl: response.url,
    });

    if (!response.ok && response.status !== 304) {
      throw new Error(`migros HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function scrapeSok(product) {
  const query = improveSearchQuery(product);
  const variants = [query];

  if (query.includes("sut")) variants.push(query.replace("sut", "s\u00fct"));
  if (query.includes("cilek")) variants.push(query.replace("cilek", "\u00e7ilek"));
  if (query.includes("kasar")) variants.push(query.replace("kasar", "ka\u015far"));

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

  for (const query of queries) {
    try {
      const items = await fetchMigrosApiResults(query, MIGROS_RESULT_LIMIT);
      if (items.length > 0) {
        logScrape("Migros", `API returned ${items.length} items for "${query}"`);
        return items.slice(0, MIGROS_RESULT_LIMIT);
      }
    } catch (err) {
      logScrape("Migros", `API error for "${query}": ${err.message}`);
    }
  }

  let browser;
  try {
    const executablePath = resolveChromeExecutablePath();
    logMigrosDebug("launch config", {
      executablePath: executablePath || "default",
      cacheDir:
        process.env.PUPPETEER_CACHE_DIR ||
        process.env.PUPPETEER_CACHE_DIRECTORY ||
        null,
    });

    browser = await puppeteer.launch({
      headless: "new",
      executablePath: executablePath || undefined,
      protocolTimeout: NAV_TIMEOUT_MS,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--disable-extensions",
        "--disable-infobars",
        "--disable-gpu",
        "--hide-scrollbars",
        "--mute-audio",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(CHROME_USER_AGENT);

    for (const query of queries) {
      await page.setExtraHTTPHeaders(
        migrosRequestHeaders(
          `https://www.migros.com.tr/arama?q=${encodeURIComponent(query)}`,
        ),
      );
      await page.goto(
        `https://www.migros.com.tr/arama?q=${encodeURIComponent(query)}`,
        { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS },
      );

      await delay(4000);

      let items = await extractMigrosItemsFromPage(page).catch((err) => {
        logScrape("Migros", `Puppeteer DOM extract error for "${query}": ${err.message}`);
        return [];
      });
      if (items.length > 0) {
        logScrape("Migros", `Puppeteer DOM extract returned ${items.length} items for "${query}"`);
        return items.slice(0, MIGROS_RESULT_LIMIT);
      }

      const html = await page.content();
      items = parseMigrosHtml(html);
      if (items.length > 0) {
        logScrape("Migros", `Puppeteer HTML parse returned ${items.length} items for "${query}"`);
        return items.slice(0, MIGROS_RESULT_LIMIT);
      }
    }
  } catch (err) {
    logScrape("Migros", `Local puppeteer error: ${err.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  for (const query of queries) {
    try {
      const html = await fetchMigrosHtml(query);
      const items = parseMigrosHtml(html);
      if (items.length > 0) {
        logScrape("Migros", `Direct fetch returned ${items.length} items for "${query}"`);
        return items.slice(0, MIGROS_RESULT_LIMIT);
      }
    } catch (err) {
      logScrape("Migros", `Direct fetch error for "${query}": ${err.message}`);
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
    const migrosItem =
      Array.isArray(migrosItems) && migrosItems.length > 0 ? migrosItems[0] : null;

    const sokUnit = sokItem ? Number(sokItem.price) : null;
    const migrosUnit = migrosItem ? Number(migrosItem.price) : null;

    const sokCost =
      sokUnit !== null && Number.isFinite(sokUnit) ? sokUnit * quantity : null;
    const migrosCost =
      migrosUnit !== null && Number.isFinite(migrosUnit)
        ? migrosUnit * quantity
        : null;

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
  if (market === "migros" || market === "carrefour") {
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
  parseMigrosHtml,
};
