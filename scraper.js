const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const NAV_TIMEOUT_MS = 60000;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CARREFOUR_PROXY_MODE = String(process.env.CARREFOUR_PROXY_MODE || "off")
  .trim()
  .toLowerCase();
const CARREFOUR_PROXY_ENDPOINT = String(
  process.env.CARREFOUR_PROXY_ENDPOINT || "",
).trim();
const CARREFOUR_PROXY_API_KEY = String(
  process.env.CARREFOUR_PROXY_API_KEY || "",
).trim();
const CARREFOUR_PROXY_REGION = String(
  process.env.CARREFOUR_PROXY_REGION || "TR",
).trim();
const CARREFOUR_PROXY_TIMEOUT_MS = Number.parseInt(
  process.env.CARREFOUR_PROXY_TIMEOUT_MS || "30000",
  10,
);
const CARREFOUR_DEBUG =
  String(process.env.CARREFOUR_DEBUG || "").trim() === "1";
const CARREFOUR_MIRROR_FALLBACK =
  String(process.env.CARREFOUR_MIRROR_FALLBACK || "1").trim() !== "0";

// Configurable Carrefour scraping service (e.g., ScrapingBee, ScraperAPI, etc.)
// Format: https://api.scrapingservice.com/scrape?url={URL}&api_key=KEY
// The {URL} placeholder will be replaced with the encoded Carrefour URL
const CARREFOUR_SCRAPER_SERVICE = String(
  process.env.CARREFOUR_SCRAPER_SERVICE || "",
).trim();

// Detect if running on cloud (Render, etc.) vs localhost
const IS_CLOUD = Boolean(
  process.env.RENDER ||
  process.env.PORT ||
  process.env.NODE_ENV === "production" ||
  process.env.DYNO,
);

function logCarrefourDebug(message, extra) {
  if (!CARREFOUR_DEBUG) return;
  console.log(`[Carrefour][Debug] ${message}`, extra || "");
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePriceValue(text) {
  if (!text) return null;
  const str = String(text);
  // Match Turkish Lira patterns: 37,50₺ or ₺37,50 or 37.50 TL
  const match =
    str.match(/([\d]{1,3}(?:[\.,]\d{3})*[,\.]\d{1,2})\s*(?:₺|TL)/i) ||
    str.match(/(?:₺|TL)\s*([\d]{1,3}(?:[\.,]\d{3})*[,\.]\d{1,2})/i) ||
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
  const source = String(product || "")
    .trim()
    .toLowerCase();
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

function carrefourProxyConfigState() {
  return {
    mode: CARREFOUR_PROXY_MODE,
    hasEndpoint: Boolean(CARREFOUR_PROXY_ENDPOINT),
    hasApiKey: Boolean(CARREFOUR_PROXY_API_KEY),
    region: CARREFOUR_PROXY_REGION,
    timeoutMs: CARREFOUR_PROXY_TIMEOUT_MS,
  };
}

// ============================================================
// JINA.AI READER - Works for Sok (not Carrefour due to Cloudflare)
// ============================================================

async function fetchViaJinaReader(url) {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

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

/**
 * Parse Sok product listings from Jina.ai markdown output.
 * Actual Jina format per product line:
 *   [![Image 30: product-thumb](https://images.ceptesok.com/cdn-cgi/image/width=216,height=216,fit=pad,quality=100,format=webp/product-assets/sub-folder/9c33a0ed-7e67-48c7-8a7a-1c7baf32f01f.jpg) ## Mis Uht Süt Yarım Yağlı 1 L 37,50₺](https://www.sokmarket.com.tr/mis-uht-sut-yarim-yagli-1-l-p-5834)
 */
function parseSokFromJinaText(text) {
  const out = [];
  const seen = new Set();

  // Single regex to match entire product line: image URL + name + price
  // Format: [![Image N: product-thumb](IMAGE_URL) ## Product Name PRICE₺](PRODUCT_URL)
  const productPattern =
    /\[!\[Image \d+: product-thumb\]\((https?:\/\/[^)]+)\)[^\]]*## ([^\]]+?)\s+(\d+,\d+)\u20BA[^\]]*\]/g;
  let match;

  while ((match = productPattern.exec(text)) !== null) {
    const imageUrl = match[1];
    const fullName = match[2].trim();
    const priceStr = match[3];
    const price = Number.parseFloat(
      priceStr.replace(/\./g, "").replace(",", "."),
    );

    if (!Number.isFinite(price) || price <= 0 || price > 5000) continue;

    // Clean name - remove trailing size/volume info that's part of the name
    let name = fullName.trim();
    if (name.length < 3) continue;

    // Normalize image URL - remove resize parameters for cleaner URL
    let cleanImage = imageUrl;
    const cdnMatch = imageUrl.match(
      /(https:\/\/images\.ceptesok\.com\/cdn-cgi\/image\/[^/]+\/product-assets\/sub-folder\/[^)]+)/i,
    );
    if (cdnMatch) {
      // Extract the base product image URL without resize params
      const pathMatch = cdnMatch[1].match(
        /\/product-assets\/(sub-folder\/[^(]+)/i,
      );
      if (pathMatch) {
        cleanImage = `https://images.ceptesok.com/product-assets/${pathMatch[1]}`;
      }
    }

    const key = `${name.toLowerCase()}|${price.toFixed(2)}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({
        market: "Sok",
        name: normalizeText(name),
        price,
        image: cleanImage,
      });
    }
  }

  // Fallback: line-by-line if pattern doesn't match
  if (out.length === 0) {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes("product-thumb")) continue;

      // Extract image URL
      const imgMatch = line.match(/\((https?:\/\/[^)]+product[^)]+)\)/i);
      if (!imgMatch) continue;
      const image = imgMatch[1];

      // Extract price
      const priceMatch = line.match(/(\d+,\d+)\u20BA/);
      if (!priceMatch) continue;
      const price = Number.parseFloat(priceMatch[1].replace(",", "."));
      if (!Number.isFinite(price) || price <= 0 || price > 5000) continue;

      // Extract name - between ## and price
      const nameMatch = line.match(/##\s+(.+?)\s+\d+,\d+\u20BA/);
      if (!nameMatch) continue;
      const name = nameMatch[1].trim();
      if (name.length < 3) continue;

      const key = `${name.toLowerCase()}|${price.toFixed(2)}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ market: "Sok", name: normalizeText(name), price, image });
      }
    }
  }

  console.log(`[Sok] Parser found: ${out.length} items`);
  return dedupeItems(out);
}

/**
 * Parse Carrefour from Jina.ai text output.
 * Carrefour blocks Jina with Cloudflare, but sometimes the mobile site or
 * alternative URLs work.
 */
function parseCarrefourFromJinaText(text) {
  const out = [];
  const seen = new Set();

  // Check if we got blocked by Cloudflare
  if (
    /attention required|cloudflare|blocked|captcha|security check/i.test(text)
  ) {
    return [];
  }

  // Pattern: Product name + price in various formats
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip non-product lines
    if (
      /^(sepete ekle|kabul et|filtrele|ana sayfa|kampanya|cookie|gizlilik)/i.test(
        line,
      )
    )
      continue;
    if (/^\[?\!\[?image/i.test(line)) continue;

    const price = parsePriceValue(line);
    if (!price) continue;

    let name = line
      .replace(/[\d]{1,3}(?:[\.,]\d{3})*[,\.]\d{1,2}\s*(?:₺|TL)/gi, "")
      .trim();
    name = name.replace(/^#+\s*/, "").trim();

    if (name.length < 3) {
      // Look at previous lines for product name
      for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
        const candidate = lines[j]
          .replace(/^#+\s*/, "")
          .replace(/\[\!\[.*$/, "")
          .trim();
        if (candidate.length >= 3 && !parsePriceValue(candidate)) {
          if (
            !/^(sepete ekle|kabul et|filtrele|ana sayfa|kampanya)/i.test(
              candidate,
            )
          ) {
            name = candidate;
            break;
          }
        }
      }
    }

    if (name.length < 3) continue;

    const key = `${name.toLowerCase()}|${price.toFixed(2)}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({
        market: "Carrefour",
        name: normalizeText(name),
        price,
        image: "",
      });
    }
  }

  return dedupeItems(out);
}

// ============================================================
// GOOGLE SEARCH FALLBACK (for Carrefour when direct access is blocked)
// ============================================================

async function searchViaGoogle(product, market) {
  const site = market === "sok" ? "sokmarket.com.tr" : "carrefoursa.com";
  const query = `site:${site} "${product}"`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=tr&num=20`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept-Language": "tr-TR,tr;q=0.9",
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Google search HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseGoogleResults(html, marketName) {
  const items = [];
  const seen = new Set();

  // Extract result links and snippets
  const resultRegex =
    /<a[^>]*href="(https?:\/\/[^"]*(?:sokmarket|carrefour)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = resultRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].replace(/<[^>]+>/g, "").trim();

    if (title.length < 3 || title.length > 150) continue;
    if (/^(google|cache|translate)/i.test(title)) continue;

    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      market: marketName,
      name: normalizeText(title),
      price: null,
      image: "",
      url,
    });
  }

  return items;
}

// ============================================================
// BING SEARCH FALLBACK
// ============================================================

async function searchViaBing(product, market) {
  const site = market === "sok" ? "sokmarket.com.tr" : "carrefoursa.com";
  const query = `site:${site} "${product}" fiyat`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept-Language": "tr-TR,tr;q=0.9",
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Bing search HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseBingResults(html, marketName) {
  const items = [];
  const seen = new Set();

  // Bing result titles
  const titleRegex = /<h2><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>/gi;
  let match;

  while ((match = titleRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].replace(/<[^>]+>/g, "").trim();

    if (title.length < 3 || title.length > 150) continue;
    if (!url.includes(marketName === "Sok" ? "sokmarket" : "carrefour"))
      continue;

    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Try to extract price from snippet
    const snippetRegex = new RegExp(
      `<p[^>]*>[^<]*(${marketName === "Sok" ? "sokmarket" : "carrefour"}[^<]*)`,
      "i",
    );

    items.push({
      market: marketName,
      name: normalizeText(title),
      price: null,
      image: "",
      url,
    });
  }

  return items;
}

// ============================================================
// PUPPETEER - Only for localhost (residential IPs work fine)
// ============================================================

async function createConfiguredPage(browser) {
  const page = await browser.newPage();

  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
  await page.setUserAgent(userAgent);
  await page.setViewport({ width: 1920, height: 1080 });

  await page.setExtraHTTPHeaders({
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "max-age=0",
    Connection: "keep-alive",
    "sec-ch-ua":
      '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    window.chrome = { runtime: {} };
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", {
      get: () => ["tr-TR", "tr", "en-US", "en"],
    });
    delete navigator.__proto__.webdriver;
  });

  return page;
}

async function gotoWithRetry(page, url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });
      return true;
    } catch (err) {
      if (i === retries) throw err;
      await delay(2000);
    }
  }
  return false;
}

async function waitForContent(page, selector, timeout = 15000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

function extractHtmlFromProxyPayload(data) {
  if (!data || typeof data !== "object") return "";
  const directKeys = ["html", "content", "body", "result", "data"];
  for (const key of directKeys) {
    const value = data[key];
    if (typeof value === "string" && value.includes("<html")) return value;
  }
  if (Array.isArray(data.results)) {
    for (const item of data.results) {
      if (item && typeof item.html === "string" && item.html.includes("<html"))
        return item.html;
      if (
        item &&
        typeof item.content === "string" &&
        item.content.includes("<html")
      )
        return item.content;
    }
  }
  return "";
}

async function fetchCarrefourHtmlViaProxy(query) {
  const targetUrl = `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`;
  if (!CARREFOUR_PROXY_ENDPOINT || !CARREFOUR_PROXY_API_KEY) {
    throw new Error("proxy endpoint/key missing");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(5000, CARREFOUR_PROXY_TIMEOUT_MS),
  );
  try {
    let requestUrl = CARREFOUR_PROXY_ENDPOINT;
    let method = "POST";
    let body = {
      url: targetUrl,
      render: true,
      region: CARREFOUR_PROXY_REGION,
      country: CARREFOUR_PROXY_REGION,
      js_render: true,
    };

    if (requestUrl.includes("{url}")) {
      requestUrl = requestUrl.replace("{url}", encodeURIComponent(targetUrl));
      method = "GET";
      body = null;
    }

    const headers = {
      Accept: "application/json, text/html, */*",
      "Content-Type": "application/json",
      Authorization: `Bearer ${CARREFOUR_PROXY_API_KEY}`,
      "X-API-Key": CARREFOUR_PROXY_API_KEY,
    };

    logCarrefourDebug("Proxy request", {
      endpoint: requestUrl,
      method,
      region: CARREFOUR_PROXY_REGION,
    });

    const response = await fetch(requestUrl, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`proxy http ${response.status}`);

    let html = "";
    if (raw.includes("<html")) {
      html = raw;
    } else {
      try {
        const json = JSON.parse(raw);
        html = extractHtmlFromProxyPayload(json);
      } catch (_) {
        html = "";
      }
    }

    if (!html) throw new Error("proxy returned no html");
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch Carrefour HTML via a configurable third-party scraping service.
 * This is the ONLY reliable way to scrape Carrefour from cloud hosting.
 *
 * Env: CARREFOUR_SCRAPER_SERVICE
 * Format: https://api.service.com/scrape?url={URL}&api_key=KEY
 * Examples:
 *   ScrapingBee: https://app.scrapingbee.com/api/v1/?api_key=KEY&url={URL}&render_js=false
 *   ScraperAPI:  http://api.scraperapi.com/?api_key=KEY&url={URL}
 *   ScrapingDog: https://api.scrapingdog.com/scrape?api_key=KEY&url={URL}
 */
async function fetchCarrefourViaScraperService(query) {
  if (!CARREFOUR_SCRAPER_SERVICE) return null;

  const targetUrl = `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`;
  const serviceUrl = CARREFOUR_SCRAPER_SERVICE.replace(
    "{URL}",
    encodeURIComponent(targetUrl),
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    console.log(
      `[Carrefour] Using scraper service: ${serviceUrl.substring(0, 80)}...`,
    );
    const response = await fetch(serviceUrl, {
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

function parseCarrefourHtml(html) {
  const normalizedHtml = String(html || "");
  if (!normalizedHtml) return [];

  const items = [];
  const seen = new Set();

  const patterns = [
    /<li[^>]*class="[^"]*product-listing-item[^"]*"[^>]*>[\s\S]*?<\/li>/gi,
    /<div[^>]*class="[^"]*product-card[^"]*"[^>]*>[\s\S]*?<\/div>(?=\s*<)/gi,
    /<a[^>]*href="[^"]*\/product[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
  ];

  let cards = [];
  for (const pattern of patterns) {
    cards = normalizedHtml.match(pattern) || [];
    if (cards.length > 0) break;
  }

  for (const card of cards) {
    const nameMatch =
      card.match(
        /<h3[^>]*class="[^"]*item-name[^"]*"[^>]*>([\s\S]*?)<\/h3>/i,
      ) ||
      card.match(
        /<h[2-4][^>]*class="[^"]*product-name[^"]*"[^>]*>([\s\S]*?)<\/h[2-4]>/i,
      ) ||
      card.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i);
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
      /<img[^>]+(?:src|data-src|data-lazy)="([^"]+)"[^>]*>/i,
    );
    const image = normalizeText(imageMatch?.[1] || "");

    if (!name || !price) continue;
    const key = `${name.toLowerCase()}|${price.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ market: "Carrefour", name, price, image });
  }

  if (items.length > 0) return dedupeItems(items);

  // Text fallback
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

  for (let i = 0; i < lines.length; i += 1) {
    const price = parsePriceValue(lines[i]);
    if (!price) continue;
    let name = "";
    for (let j = i - 1; j >= Math.max(0, i - 4); j -= 1) {
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
        str.match(/\u20BA\s*([\d.,]+)/) ||
        str.match(/([\d.,]+)\s*(TL|\u20BA)/i) ||
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

      const priceText = `${card.querySelector(".js-variant-discounted-price")?.textContent || ""} ${card.querySelector(".price-cont")?.textContent || ""} ${rawText}`;
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

async function scrapeCarrefourDirect(query) {
  const browser = await puppeteer.launch({
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
  const page = await createConfiguredPage(browser);

  try {
    console.log(`[Carrefour] Puppeteer: Navigating...`);
    await delay(1000 + Math.random() * 1000);

    try {
      await page.goto("https://www.carrefoursa.com", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await delay(2000 + Math.random() * 1000);
    } catch (_) {}

    await gotoWithRetry(
      page,
      `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`,
    );
    await delay(3000 + Math.random() * 2000);

    try {
      await page.evaluate(() => {
        const labels = ["kabul et", "accept", "tamam", "onayla"];
        const nodes = Array.from(
          document.querySelectorAll("button, a, [role='button']"),
        );
        for (const node of nodes) {
          const text = String(node.textContent || "")
            .trim()
            .toLowerCase();
          if (labels.some((label) => text === label || text.includes(label)))
            node.click();
        }
      });
      await delay(1000);
    } catch (_) {}

    await Promise.race([
      waitForContent(
        page,
        ".product-listing-item, .product-card, [class*='product-card']",
        10000,
      ),
      new Promise((resolve) => setTimeout(() => resolve(false), 10000)),
    ]);

    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 600 + Math.random() * 500));
      await delay(800 + Math.random() * 600);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(500);

    const items = await extractCarrefourItemsFromPage(page);
    if (items.length > 0) return items;

    const html = await page.content();
    return parseCarrefourHtml(html);
  } finally {
    await browser.close();
  }
}

// ============================================================
// SOK SCRAPING
// ============================================================

async function scrapeSokViaJina(product) {
  const query = String(product || "")
    .trim()
    .toLowerCase();
  const variants = [query];
  if (query.includes("sut")) variants.push(query.replace("sut", "s\u00fct"));
  if (query.includes("cilek"))
    variants.push(query.replace("cilek", "\u00e7ilek"));
  if (query.includes("kasar"))
    variants.push(query.replace("kasar", "ka\u015far"));

  for (const q of variants) {
    console.log(`[Sok] Jina reader searching: ${q}`);
    try {
      const url = `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(q)}`;
      const text = await fetchViaJinaReader(url);

      if (/attention required|cloudflare|blocked/i.test(text)) {
        console.log(`[Sok] Jina reader blocked by Cloudflare`);
        continue;
      }

      const items = parseSokFromJinaText(text);
      if (items.length > 0) {
        console.log(`[Sok] Jina reader found: ${items.length} items`);
        return items;
      }
      console.log(`[Sok] Jina reader parsed 0 items, trying next variant...`);
    } catch (err) {
      console.log(`[Sok] Jina reader error: ${err.message}`);
    }
  }
  return [];
}

async function scrapeSokPuppeteer(product) {
  const browser = await puppeteer.launch({
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
  const page = await createConfiguredPage(browser);

  try {
    console.log(`[Sok] Puppeteer: Searching for: ${product}`);
    await delay(800 + Math.random() * 800);

    try {
      await page.goto("https://www.sokmarket.com.tr", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await delay(1500 + Math.random() * 1000);
    } catch (_) {}

    await gotoWithRetry(
      page,
      `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(product)}`,
    );
    await delay(2500 + Math.random() * 1500);

    try {
      await page.evaluate(() => {
        const labels = ["kabul et", "accept", "tamam", "onayla"];
        const nodes = Array.from(document.querySelectorAll("button, a"));
        for (const node of nodes) {
          const text = String(node.textContent || "")
            .trim()
            .toLowerCase();
          if (labels.some((label) => text === label || text.includes(label)))
            node.click();
        }
      });
      await delay(800);
    } catch (_) {}

    await Promise.race([
      waitForContent(
        page,
        ".product-card, .product-item, [class*='product-card']",
        8000,
      ),
      new Promise((resolve) => setTimeout(() => resolve(false), 8000)),
    ]);

    await page.evaluate(() => window.scrollBy(0, 800 + Math.random() * 400));
    await delay(1000 + Math.random() * 500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(500);

    const items = await page.evaluate(() => {
      const normalize = (value) =>
        String(value || "")
          .replace(/\s+/g, " ")
          .trim();
      const parsePrice = (text) => {
        const str = String(text || "");
        const match =
          str.match(/\u20BA\s*([\d.,]+)/) ||
          str.match(/([\d.,]+)\s*(TL|\u20BA)/i) ||
          str.match(/([\d]+[.,]\d{2})/);
        if (!match) return null;
        return Number.parseFloat(
          String(match[1]).replace(/\./g, "").replace(",", "."),
        );
      };

      const out = [];
      const seen = new Set();
      const selectors = [
        ".product-card",
        ".product-item",
        '[class*="ProductCard"]',
        '[class*="product-card"]',
        '[class*="product-"]',
      ];

      let nodes = [];
      for (const sel of selectors) {
        const found = document.querySelectorAll(sel);
        if (found.length) {
          nodes = Array.from(found);
          break;
        }
      }

      nodes.forEach((el) => {
        const text = normalize(el.innerText);
        if (text.length < 3) return;
        const price = parsePrice(text);
        if (!Number.isFinite(price) || price <= 0 || price > 5000) return;

        let name = "";
        for (const sel of [
          "h2",
          "h3",
          ".name",
          '[class*="name"]',
          '[class*="title"]',
        ]) {
          const nameEl = el.querySelector(sel);
          if (nameEl?.innerText) {
            name = normalize(nameEl.innerText);
            if (name) break;
          }
        }
        if (!name) name = normalize((el.innerText || "").split("\n")[0]);

        const imgEl = el.querySelector("img");
        const image =
          imgEl?.currentSrc ||
          imgEl?.src ||
          imgEl?.getAttribute("data-src") ||
          "";

        const key = `${name.toLowerCase()}|${price.toFixed(2)}`;
        if (name && !seen.has(key)) {
          seen.add(key);
          out.push({ market: "Sok", name, price, image });
        }
      });

      return out;
    });

    const result = dedupeItems(items);
    console.log(`[Sok] Puppeteer found: ${result.length} items`);
    return result;
  } catch (err) {
    console.error(`[Sok] Puppeteer error:`, err.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeSok(product) {
  // Strategy 1: Jina.ai reader (works on cloud, bypasses IP blocks)
  const jinaItems = await scrapeSokViaJina(product);
  if (jinaItems.length > 0) return jinaItems;

  // Strategy 2: Puppeteer (works on localhost with residential IP)
  if (!IS_CLOUD) {
    console.log("[Sok] Jina failed, trying Puppeteer (localhost)...");
    return await scrapeSokPuppeteer(product);
  }

  // Strategy 3: Google search fallback (cloud)
  console.log("[Sok] Trying Google search fallback...");
  try {
    const html = await searchViaGoogle(product, "sok");
    const googleItems = parseGoogleResults(html, "Sok");
    if (googleItems.length > 0) {
      console.log(`[Sok] Google search found: ${googleItems.length} items`);
      return googleItems;
    }
  } catch (err) {
    console.log(`[Sok] Google search error: ${err.message}`);
  }

  // Strategy 4: Bing search fallback (cloud)
  console.log("[Sok] Trying Bing search fallback...");
  try {
    const html = await searchViaBing(product, "sok");
    const bingItems = parseBingResults(html, "Sok");
    if (bingItems.length > 0) {
      console.log(`[Sok] Bing search found: ${bingItems.length} items`);
      return bingItems;
    }
  } catch (err) {
    console.log(`[Sok] Bing search error: ${err.message}`);
  }

  console.log("[Sok] Results: 0 items");
  return [];
}

// ============================================================
// CARREFOUR SCRAPING
// ============================================================

async function scrapeCarrefourViaJina(product) {
  const queries = carrefourQueryVariants(product);

  for (const query of queries) {
    console.log(`[Carrefour] Jina reader searching: ${query}`);
    try {
      const url = `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`;
      const text = await fetchViaJinaReader(url);
      const items = parseCarrefourFromJinaText(text);
      if (items.length > 0) {
        console.log(`[Carrefour] Jina reader found: ${items.length} items`);
        return items;
      }
    } catch (err) {
      console.log(`[Carrefour] Jina reader error: ${err.message}`);
    }
  }
  return [];
}

async function scrapeCarrefour(product) {
  const cfg = carrefourProxyConfigState();

  // Priority 1: Configurable scraping service (ONLY reliable method for Carrefour on cloud)
  if (CARREFOUR_SCRAPER_SERVICE) {
    const queries = carrefourQueryVariants(product);
    for (const query of queries) {
      try {
        const html = await fetchCarrefourViaScraperService(query);
        if (html) {
          const items = parseCarrefourHtml(html);
          if (items.length > 0) {
            console.log(
              `[Carrefour] Scraper service found: ${items.length} items`,
            );
            return items;
          }
        }
      } catch (err) {
        console.log(`[Carrefour] Scraper service error: ${err.message}`);
      }
    }
  }

  // Priority 2: Proxy (if configured)
  if (cfg.mode === "required" || cfg.mode === "fallback") {
    const queries = carrefourQueryVariants(product);
    for (const query of queries) {
      try {
        console.log(`[Carrefour] Trying proxy for: ${query}`);
        const html = await fetchCarrefourHtmlViaProxy(query);
        const proxyItems = parseCarrefourHtml(html);
        if (proxyItems.length > 0) {
          console.log(`[Carrefour] Proxy found: ${proxyItems.length} items`);
          return proxyItems;
        }
      } catch (err) {
        logCarrefourDebug("Proxy error", err.message);
        if (cfg.mode === "required") {
          console.log("[Carrefour] Proxy required mode failed");
          return [];
        }
      }
    }
  }

  // Priority 2: Jina.ai reader (sometimes works for Carrefour)
  if (cfg.mode === "off" || cfg.mode === "fallback") {
    const jinaItems = await scrapeCarrefourViaJina(product);
    if (jinaItems.length > 0) return jinaItems;
  }

  // Priority 3: Google search fallback
  if (cfg.mode === "off" || cfg.mode === "fallback" || IS_CLOUD) {
    console.log("[Carrefour] Trying Google search fallback...");
    try {
      const html = await searchViaGoogle(product, "carrefour");
      const googleItems = parseGoogleResults(html, "Carrefour");
      if (googleItems.length > 0) {
        console.log(
          `[Carrefour] Google search found: ${googleItems.length} items`,
        );
        return googleItems;
      }
    } catch (err) {
      console.log(`[Carrefour] Google search error: ${err.message}`);
    }
  }

  // Priority 4: Bing search fallback
  if (cfg.mode === "off" || cfg.mode === "fallback" || IS_CLOUD) {
    console.log("[Carrefour] Trying Bing search fallback...");
    try {
      const html = await searchViaBing(product, "carrefour");
      const bingItems = parseBingResults(html, "Carrefour");
      if (bingItems.length > 0) {
        console.log(`[Carrefour] Bing search found: ${bingItems.length} items`);
        return bingItems;
      }
    } catch (err) {
      console.log(`[Carrefour] Bing search error: ${err.message}`);
    }
  }

  // Priority 5: Puppeteer (only on localhost)
  if (cfg.mode === "off" || cfg.mode === "fallback") {
    console.log("[Carrefour] Trying Puppeteer (localhost only)...");
    try {
      const directItems = await scrapeCarrefourDirect(product);
      if (directItems.length > 0) return directItems;
    } catch (err) {
      logCarrefourDebug("Direct Puppeteer error", err.message);
    }
  }

  // Priority 6: Jina mirror fallback
  if (CARREFOUR_MIRROR_FALLBACK) {
    const queries = carrefourQueryVariants(product);
    for (const query of queries) {
      try {
        console.log(`[Carrefour] Trying Jina mirror for: ${query}`);
        const targetUrl = `http://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`;
        const jinaUrl = `https://r.jina.ai/${targetUrl}`;
        const response = await fetch(jinaUrl, {
          headers: { Accept: "text/plain", "User-Agent": "Mozilla/5.0" },
        });
        if (response.ok) {
          const raw = await response.text();
          const mirrorItems = parseCarrefourFromJinaText(raw);
          if (mirrorItems.length > 0) {
            console.log(
              `[Carrefour] Jina mirror found: ${mirrorItems.length} items`,
            );
            return mirrorItems;
          }
        }
      } catch (err) {
        logCarrefourDebug("Mirror path error", err.message);
      }
    }
  }

  console.log("[Carrefour] Results: 0 items");
  return [];
}

// ============================================================
// MAIN EXPORTS
// ============================================================

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
  console.log(`[Search] Looking for "${product}" in ${market}`);
  if (market === "sok") return await scrapeSok(product);
  if (market === "carrefour") return await scrapeCarrefour(product);
  return null;
}

async function searchMultiple(product) {
  console.log(`[SearchAll] Looking for "${product}" in all markets`);
  const [sok, carrefour] = await Promise.all([
    scrapeSok(product).catch(() => []),
    scrapeCarrefour(product).catch(() => []),
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
