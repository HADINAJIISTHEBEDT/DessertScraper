const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const NAV_TIMEOUT_MS = 60000;
const SEARCH_TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS || 25000);
const JINA_TIMEOUT_MS = Number(process.env.JINA_TIMEOUT_MS || 20000);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const IS_CLOUD = Boolean(
  process.env.RENDER ||
  process.env.PORT ||
  process.env.NODE_ENV === "production" ||
  process.env.DYNO,
);

const CARREFOUR_SCRAPER_SERVICE = String(
  process.env.CARREFOUR_SCRAPER_SERVICE || "",
).trim();
const CARREFOUR_COOKIE = String(process.env.CARREFOUR_COOKIE || "").trim();
const CARREFOUR_ACCEPT_LANGUAGE = String(
  process.env.CARREFOUR_ACCEPT_LANGUAGE || "en-US,en;q=0.9",
).trim();
const CARREFOUR_REFERER = String(
  process.env.CARREFOUR_REFERER || "https://www.carrefoursa.com/search/?q=sut",
).trim();

const CARREFOUR_DEBUG =
  String(process.env.CARREFOUR_DEBUG || "").trim() === "1";
const SCRAPER_API_KEY = String(process.env.SCRAPER_API_KEY || "").trim();
const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

function logCarrefourDebug(message, extra) {
  if (!CARREFOUR_DEBUG) return;
  console.log(`[Carrefour][Debug] ${message}`, extra || "");
}

function logScrape(stage, message) {
  console.log(`[Scraper][${stage}] ${message}`);
}

async function withTimeout(label, promise, timeoutMs = SEARCH_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function carrefourRequestHeaders(referer) {
  const headers = {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": CARREFOUR_ACCEPT_LANGUAGE,
    "Cache-Control": "max-age=0",
    Priority: "u=0, i",
    Referer: referer || CARREFOUR_REFERER,
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

  if (CARREFOUR_COOKIE) headers.Cookie = CARREFOUR_COOKIE;
  return headers;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function improveSearchQuery(q) {
  return String(q || "")
    .toLowerCase()
    .trim()
    .replace(/\bmilk\b/g, "s\u00fct")
    .replace(/\bcheese\b/g, "peynir")
    .replace(/\byogurt\b/g, "yo\u011furt")
    .replace(/\bsut\b/g, "s\u00fct")
    .replace(/\bkasar\b/g, "ka\u015far")
    .replace(/\bcilek\b/g, "\u00e7ilek");
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

function carrefourQueryVariants(product) {
  const source = improveSearchQuery(product);
  if (!source) return [];

  const variants = new Set([source]);
  const pairs = [
    ["sut", "s\u00fct"],
    ["yogurt", "yo\u011furt"],
    ["cilek", "\u00e7ilek"],
    ["kasar", "ka\u015far"],
    ["kofte", "k\u00f6fte"],
  ];

  for (const [a, b] of pairs) {
    if (source.includes(a)) variants.add(source.replaceAll(a, b));
  }

  return [...variants];
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
    if (!seen.has(key)) {
      seen.add(key);
      out.push({
        market: "Sok",
        name: normalizeText(fullName),
        price,
        image: imageUrl,
      });
    }
  }

  return dedupeItems(out);
}

function parseCarrefourHtml(html) {
  const normalizedHtml = String(html || "");
  if (!normalizedHtml) return [];

  if (
    /attention required|cloudflare|captcha|security check|blocked/i.test(
      normalizedHtml,
    )
  ) {
    return [];
  }

  const items = [];
  const seen = new Set();

  const cardPatterns = [
    /<li[^>]*data-testid="product-card"[^>]*>[\s\S]*?<\/li>/gi,
    /<div[^>]*class="[^"]*product-card[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    /<a[^>]*href="[^"]*\/product[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
  ];

  let cards = [];
  for (const pattern of cardPatterns) {
    cards = normalizedHtml.match(pattern) || [];
    if (cards.length > 0) break;
  }

  for (const card of cards) {
    const nameMatch =
      card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) ||
      card.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) ||
      card.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);

    const name = normalizeText(
      (nameMatch?.[1] || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " "),
    );

    const priceCandidate =
      card.match(
        /js-variant-discounted-price[^>]*>([\s\S]*?)<\/[^>]+>/i,
      )?.[1] ||
      card.match(/price-cont[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ||
      card.match(/class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ||
      card;

    const price = parsePriceValue(
      String(priceCandidate || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " "),
    );

    const imageMatch = card.match(
      /<img[^>]+(?:src|data-src|data-lazy)="([^"]+)"/i,
    );
    const image = normalizeText(imageMatch?.[1] || "");

    if (!name || !price) continue;

    const key = `${name.toLowerCase()}|${price.toFixed(2)}`;
    if (seen.has(key)) continue;

    seen.add(key);
    items.push({ market: "Carrefour", name, price, image });
  }

  if (items.length > 0) return dedupeItems(items);

  const text = normalizeText(
    normalizedHtml
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n"),
  );

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const textItems = [];
  const textSeen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const price = parsePriceValue(lines[i]);
    if (!price) continue;

    let name = "";
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      const candidate = lines[j];
      if (!candidate || candidate.length < 2) continue;
      if (parsePriceValue(candidate)) continue;
      if (
        /sepete ekle|kabul et|filtrele|ana sayfa|kampanya|cookie/i.test(
          candidate,
        )
      )
        continue;
      name = candidate;
      break;
    }

    if (!name) continue;

    const key = `${name.toLowerCase()}|${price.toFixed(2)}`;
    if (textSeen.has(key)) continue;

    textSeen.add(key);
    textItems.push({ market: "Carrefour", name, price, image: "" });
  }

  return dedupeItems(textItems);
}

async function extractCarrefourItemsFromPage(page) {
  const items = await page.evaluate(() => {
    const normalize = (value) =>
      String(value || "")
        .replace(/\s+/g, " ")
        .trim();

    const parsePrice = (text) => {
      const str = String(text || "");
      const match =
        str.match(/([\d]{1,3}(?:[.,]\d{3})*[.,]\d{1,2})\s*(?:\u20BA|TL)/i) ||
        str.match(/(?:\u20BA|TL)\s*([\d]{1,3}(?:[.,]\d{3})*[.,]\d{1,2})/i) ||
        str.match(/([\d]+[.,]\d{2})/);
      if (!match) return null;
      return Number.parseFloat(
        String(match[1]).replace(/\./g, "").replace(",", "."),
      );
    };

    const selectors = [
      ".product-listing-item",
      ".product-card",
      ".item.product-card",
      '[class*="product-listing-item"]',
      '[class*="product-card"]',
      '[class*="productCard"]',
      'li[class*="product"]',
      'a[href*="/product/"]',
    ];

    let cards = [];
    for (const sel of selectors) {
      const found = document.querySelectorAll(sel);
      if (found.length > 0) {
        cards = Array.from(found);
        break;
      }
    }

    const out = [];
    const seen = new Set();

    cards.forEach((card) => {
      const rawText = String(card.innerText || "").trim();
      if (!rawText) return;

      let name =
        normalize(card.querySelector(".item-name")?.textContent) ||
        normalize(card.querySelector("[class*='item-name']")?.textContent) ||
        normalize(card.querySelector("[class*='product-name']")?.textContent) ||
        normalize(card.querySelector("h3, h2, h4")?.textContent);

      if (!name) {
        const firstLine =
          rawText
            .split("\n")
            .map((s) => s.trim())
            .find((s) => s.length > 2) || "";
        name = normalize(firstLine);
      }

      const priceText =
        `${card.querySelector(".js-variant-discounted-price")?.textContent || ""} ` +
        `${card.querySelector(".price-cont")?.textContent || ""} ` +
        rawText;

      const price = parsePrice(priceText);
      if (!name || !Number.isFinite(price) || price <= 0 || price > 5000)
        return;

      const img = card.querySelector("img");
      const image =
        img?.currentSrc ||
        img?.src ||
        img?.getAttribute("data-src") ||
        img?.getAttribute("data-lazy") ||
        "";

      const key = `${name.toLowerCase()}|${price.toFixed(2)}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ market: "Carrefour", name, price, image });
      }
    });

    return out;
  });

  return dedupeItems(items);
}

async function fetchCarrefourViaScraperService(query) {
  const targetUrl = `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`;
  let serviceUrl = CARREFOUR_SCRAPER_SERVICE;

  // Try ScraperAPI if no custom service URL is configured
  if (!serviceUrl && SCRAPER_API_KEY) {
    // ScraperAPI format: https://api.scraperapi.com?api_key=XXX&url=YYY&render=true
    serviceUrl =
      `https://api.scraperapi.com?api_key=${encodeURIComponent(SCRAPER_API_KEY)}` +
      `&country_code=tr&render=true&url=${encodeURIComponent(targetUrl)}`;
  }

  if (!serviceUrl) {
    throw new Error("CARREFOUR_SCRAPER_SERVICE is missing");
  }

  // If using ScraperAPI format, the URL is already fully constructed
  const resolvedUrl = serviceUrl.includes("scraperapi.com")
    ? serviceUrl
    : serviceUrl.replace("{URL}", encodeURIComponent(targetUrl));

  logCarrefourDebug(
    "Using scraper service URL",
    resolvedUrl.includes("scraperapi.com") ? "ScraperAPI" : "Custom",
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(resolvedUrl, {
      headers: { Accept: "text/html" },
      signal: controller.signal,
    });

    if (!response.ok)
      throw new Error(`scraper service HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCarrefourViaSession(query) {
  if (!CARREFOUR_COOKIE) {
    throw new Error("CARREFOUR_COOKIE is missing");
  }

  const targetUrl = `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(targetUrl, {
      headers: carrefourRequestHeaders(targetUrl),
      signal: controller.signal,
    });
    logCarrefourDebug("session fetch status", response.status);
    if (!response.ok && response.status !== 304) {
      throw new Error(`session HTTP ${response.status}`);
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
  if (query.includes("cilek"))
    variants.push(query.replace("cilek", "\u00e7ilek"));
  if (query.includes("kasar"))
    variants.push(query.replace("kasar", "ka\u015far"));

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

async function scrapeCarrefourViaJina(product) {
  const queries = carrefourQueryVariants(product);

  for (const query of queries) {
    try {
      logScrape("Carrefour", `Trying Jina for query "${query}"`);
      const url = `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`;
      const text = await withTimeout(
        "Carrefour Jina fetch",
        fetchViaJinaReader(url),
      );
      const items = parseCarrefourHtml(text);
      if (items.length > 0) {
        logScrape("Carrefour", `Jina returned ${items.length} items`);
        return items;
      }
    } catch (err) {
      logScrape("Carrefour", `Jina error for "${query}": ${err.message}`);
    }
  }

  return [];
}

async function scrapeCarrefour(product) {
  const query = improveSearchQuery(product);

  // CLOUD/RENDER: Use scraper service first (bypasses IP blocking)
  if (IS_CLOUD) {
    // Strategy 1: Try ScraperAPI or custom scraper service
    try {
      logScrape("Carrefour", "Trying cloud scraper service (primary)");
      const html = await fetchCarrefourViaScraperService(query);
      const items = parseCarrefourHtml(html);
      if (items.length > 0) {
        logScrape("Carrefour", `Cloud scraper returned ${items.length} items`);
        return items;
      }
    } catch (err) {
      logScrape("Carrefour", `Cloud scraper service error: ${err.message}`);
    }

    // Strategy 2: Try authenticated session with cookie
    if (CARREFOUR_COOKIE) {
      try {
        logScrape("Carrefour", "Trying authenticated session");
        const html = await fetchCarrefourViaSession(query);
        const items = parseCarrefourHtml(html);
        if (items.length > 0) {
          logScrape("Carrefour", `Session returned ${items.length} items`);
          return items;
        }
      } catch (err) {
        logScrape("Carrefour", `Session error: ${err.message}`);
      }
    }

    // Strategy 3: Try Jina Reader as fallback
    try {
      const items = await scrapeCarrefourViaJina(query);
      if (items.length > 0) return items;
    } catch (err) {
      logScrape("Carrefour", `Jina fallback error: ${err.message}`);
    }

    logScrape("Carrefour", "All cloud strategies failed");
    return [];
  }

  // LOCAL: Try cookie-based session first, then puppeteer
  if (CARREFOUR_COOKIE) {
    try {
      logScrape("Carrefour", "Trying authenticated session fetch");
      const html = await fetchCarrefourViaSession(query);
      const items = parseCarrefourHtml(html);
      if (items.length > 0) {
        logScrape("Carrefour", `Session fetch returned ${items.length} items`);
        return items;
      }
    } catch (err) {
      logScrape("Carrefour", `Session fetch error: ${err.message}`);
    }
  }

  // Try Jina Reader locally
  try {
    const items = await scrapeCarrefourViaJina(query);
    if (items.length > 0) return items;
  } catch (err) {
    console.log(`[Carrefour] Jina preflight error: ${err.message}`);
  }

  // Fallback to local Puppeteer
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
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

    await page.setExtraHTTPHeaders(
      carrefourRequestHeaders(
        `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`,
      ),
    );

    await page.goto(
      `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`,
      { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS },
    );

    await delay(4000);

    const html = await page.content();
    let items = parseCarrefourHtml(html);
    if (items.length > 0) return items;

    items = await extractCarrefourItemsFromPage(page).catch(() => []);
    if (items.length > 0) {
      logScrape("Carrefour", `Local puppeteer extracted ${items.length} items`);
    }
    return items;
  } catch (err) {
    logScrape("Carrefour", `Local puppeteer error: ${err.message}`);
    return [];
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function compareIngredients(ingredients) {
  const rows = [];
  let sokTotal = 0;
  let carrefourTotal = 0;

  for (const ing of ingredients) {
    const name = String(ing.name || "").trim();
    const quantity = Number(ing.quantity || 0);
    if (!name || quantity <= 0) continue;

    const [sokItems, carrefourItems] = await Promise.all([
      scrapeSok(name).catch(() => []),
      scrapeCarrefour(name).catch(() => []),
    ]);

    const sokItem =
      Array.isArray(sokItems) && sokItems.length > 0 ? sokItems[0] : null;
    const carrefourItem =
      Array.isArray(carrefourItems) && carrefourItems.length > 0
        ? carrefourItems[0]
        : null;

    const sokUnit = sokItem ? Number(sokItem.price) : null;
    const carrefourUnit = carrefourItem ? Number(carrefourItem.price) : null;

    const sokCost =
      sokUnit !== null && Number.isFinite(sokUnit) ? sokUnit * quantity : null;
    const carrefourCost =
      carrefourUnit !== null && Number.isFinite(carrefourUnit)
        ? carrefourUnit * quantity
        : null;

    if (sokCost !== null) sokTotal += sokCost;
    if (carrefourCost !== null) carrefourTotal += carrefourCost;

    rows.push({
      ingredient: name,
      quantity,
      sok: { unitPrice: sokUnit, cost: sokCost },
      carrefour: { unitPrice: carrefourUnit, cost: carrefourCost },
    });
  }

  const totals = { sok: sokTotal, carrefour: carrefourTotal };
  const hasSok = rows.some((row) => row.sok.unitPrice !== null);
  const hasCarrefour = rows.some((row) => row.carrefour.unitPrice !== null);

  let cheapestMarket = "N/A";
  let cheapestTotal = null;

  const markets = [];
  if (hasSok) markets.push({ name: "Sok", total: sokTotal });
  if (hasCarrefour) markets.push({ name: "Carrefour", total: carrefourTotal });

  if (markets.length > 0) {
    markets.sort((a, b) => a.total - b.total);
    cheapestMarket = markets[0].name;
    cheapestTotal = markets[0].total;
  }

  return { rows, totals, cheapestMarket, cheapestTotal };
}

async function searchProduct(product, market) {
  if (market === "sok") {
    return await withTimeout(
      `searchProduct sok:${product}`,
      scrapeSok(product),
    );
  }
  if (market === "carrefour") {
    return await withTimeout(
      `searchProduct carrefour:${product}`,
      scrapeCarrefour(product),
    );
  }
  return [];
}

async function searchMultiple(product) {
  const [sok, carrefour] = await Promise.all([
    withTimeout(`searchMultiple sok:${product}`, scrapeSok(product)).catch(
      (err) => {
        logScrape("Sok", err.message);
        return [];
      },
    ),
    withTimeout(
      `searchMultiple carrefour:${product}`,
      scrapeCarrefour(product),
    ).catch((err) => {
      logScrape("Carrefour", err.message);
      return [];
    }),
  ]);

  return {
    sok: Array.isArray(sok) ? sok : [],
    carrefour: Array.isArray(carrefour) ? carrefour : [],
  };
}

module.exports = {
  compareIngredients,
  searchProduct,
  searchMultiple,
  parseCarrefourHtml,
};
