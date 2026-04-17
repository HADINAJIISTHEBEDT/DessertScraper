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

function logCarrefourDebug(message, extra) {
  if (!CARREFOUR_DEBUG) return;
  if (extra === undefined) {
    console.log(`[Carrefour][Debug] ${message}`);
  } else {
    console.log(`[Carrefour][Debug] ${message}`, extra);
  }
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePriceValue(text) {
  if (!text) return null;
  const str = String(text);
  const match =
    str.match(/\u20BA\s*([\d.,]+)/) ||
    str.match(/([\d.,]+)\s*(TL|\u20BA)/i) ||
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

async function createConfiguredPage(browser) {
  const page = await browser.newPage();

  // Set a realistic user agent
  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
  await page.setUserAgent(userAgent);
  await page.setViewport({ width: 1920, height: 1080 });

  // Set realistic headers that match a real Chrome browser
  await page.setExtraHTTPHeaders({
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
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

  // Anti-detection scripts - run before any page loads
  await page.evaluateOnNewDocument(() => {
    // Override webdriver property
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });

    // Add chrome runtime object
    window.chrome = { runtime: {} };

    // Override permissions query
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);

    // Mock plugins to appear like a real browser
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });

    // Mock languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["tr-TR", "tr", "en-US", "en"],
    });

    // Remove automation indicators
    delete navigator.__proto__.webdriver;

    // Override toString for webdriver
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter) {
      if (parameter === 37445) {
        return "Intel Inc.";
      }
      if (parameter === 37446) {
        return "Intel Iris OpenGL Engine";
      }
      return getParameter.call(this, parameter);
    };
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
      apikey: CARREFOUR_PROXY_API_KEY,
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
    if (!response.ok) {
      throw new Error(`proxy http ${response.status}`);
    }

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

    if (!html) {
      throw new Error("proxy returned no html");
    }

    logCarrefourDebug(
      "Proxy response html snippet",
      html.slice(0, 180).replace(/\s+/g, " "),
    );
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

function parseCarrefourHtml(html) {
  const normalizedHtml = String(html || "");
  if (!normalizedHtml) return [];

  const items = [];
  const seen = new Set();

  // Try multiple regex patterns for product cards
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

  // Text fallback for challenge-pruned markup.
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

    // Try multiple selectors for product cards
    const selectors = [
      ".product-listing-item",
      ".product-card",
      ".item.product-card",
      '[class*="product-listing-item"]',
      '[class*="product-card"]',
      '[class*="productCard"]',
      'li[class*="product"]',
      'a[href*="/product/"]',
      ".product-item",
      '[data-testid*="product"]',
    ];

    let cards = [];
    for (const sel of selectors) {
      const found = document.querySelectorAll(sel);
      if (found.length > 0) {
        cards = Array.from(found);
        break;
      }
    }

    // If no cards found, try to find any elements with prices
    if (cards.length === 0) {
      const allElements = Array.from(document.querySelectorAll("*"));
      for (const el of allElements) {
        const text = el.textContent || "";
        if (/\u20BA|TL/.test(text) && text.length < 100) {
          cards.push(el);
        }
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
        `${card.querySelector(".item-price")?.textContent || ""} ` +
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
        img?.getAttribute("srcset")?.split(" ")[0] ||
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
      "--disable-software-rasterizer",
      "--hide-scrollbars",
      "--mute-audio",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
  const page = await createConfiguredPage(browser);

  try {
    console.log(`[Carrefour] Navigating to search page...`);

    // Add random delay before navigation to appear more human
    await delay(1000 + Math.random() * 1000);

    // First visit the homepage, then navigate to search (more human-like)
    try {
      await page.goto("https://www.carrefoursa.com", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await delay(2000 + Math.random() * 1000);
    } catch (_) {
      // If homepage fails, continue to search directly
    }

    // Navigate to search page
    await gotoWithRetry(
      page,
      `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`,
    );

    // Wait for page to load with generous timeout
    await delay(3000 + Math.random() * 2000);

    // Handle cookie/consent banners
    try {
      await page.evaluate(() => {
        const labels = [
          "kabul et",
          "accept",
          "tamam",
          "onayla",
          "accept all",
          "accept cookies",
          "t\u00fcm\u00fcn\u00fc kabul et",
        ];
        const nodes = Array.from(
          document.querySelectorAll("button, a, [role='button'], [onclick]"),
        );
        for (const node of nodes) {
          const text = String(node.textContent || "")
            .trim()
            .toLowerCase();
          if (labels.some((label) => text === label || text.includes(label))) {
            node.click();
          }
        }
      });
      await delay(1000);
    } catch (_) {}

    // Wait for product listings to appear
    const contentLoaded = await Promise.race([
      waitForContent(
        page,
        ".product-listing-item, .product-card, [class*='product-card'], [class*='product-listing']",
        10000,
      ),
      waitForContent(page, "h3, h2, .item-name", 10000),
      new Promise((resolve) => {
        setTimeout(() => resolve(false), 10000);
      }),
    ]);

    // If no content loaded, check if we're on a challenge page
    if (!contentLoaded) {
      const pageTitle = await page.title().catch(() => "");
      console.log(`[Carrefour] Page title: ${pageTitle}`);

      // Check for challenge/captcha indicators
      const pageContent = await page.content().catch(() => "");
      if (/challenge|captcha|verify|security|robot/i.test(pageContent)) {
        console.log(
          `[Carrefour] Detected challenge/captcha page, trying alternative approach...`,
        );

        // Try waiting longer and reloading
        await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
        await delay(5000 + Math.random() * 3000);
      }
    }

    // Simulate human-like scrolling with random delays
    for (let i = 0; i < 5; i += 1) {
      await page.evaluate(() => window.scrollBy(0, 600 + Math.random() * 500));
      await delay(800 + Math.random() * 600);
    }

    // Scroll back up
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(500);

    const items = await extractCarrefourItemsFromPage(page);
    if (items.length > 0) {
      console.log(`[Carrefour] Found ${items.length} items via DOM extraction`);
      return items;
    }

    // Fallback parse from full HTML snapshot
    console.log(
      `[Carrefour] DOM extraction found 0 items, trying HTML parsing...`,
    );
    const html = await page.content();
    return parseCarrefourHtml(html);
  } finally {
    await browser.close();
  }
}

function parseCarrefourMirrorText(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const out = [];
  const seen = new Set();
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
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      market: "Carrefour",
      name: normalizeText(name),
      price,
      image: "",
    });
  }
  return dedupeItems(out);
}

async function fetchCarrefourMirrorItems(query) {
  const targetUrl = `http://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`;
  const mirrorUrl = `https://r.jina.ai/${targetUrl}`;
  const response = await fetch(mirrorUrl, {
    headers: {
      Accept: "text/plain, text/html;q=0.9, */*;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) throw new Error(`mirror http ${response.status}`);
  const raw = await response.text();
  const items = parseCarrefourMirrorText(raw);
  logCarrefourDebug("Mirror parsed result count", items.length);
  return items;
}

async function scrapeCarrefour(product) {
  const queries = carrefourQueryVariants(product);
  const cfg = carrefourProxyConfigState();
  logCarrefourDebug("Proxy config", {
    mode: cfg.mode,
    hasEndpoint: cfg.hasEndpoint,
    hasApiKey: cfg.hasApiKey,
    region: cfg.region,
    timeoutMs: cfg.timeoutMs,
  });

  for (const query of queries) {
    console.log(`[Carrefour] Searching for: ${query}`);
    let proxyError = null;

    if (cfg.mode === "required" || cfg.mode === "fallback") {
      try {
        const html = await fetchCarrefourHtmlViaProxy(query);
        const proxyItems = parseCarrefourHtml(html);
        logCarrefourDebug("Proxy parsed result count", proxyItems.length);
        if (proxyItems.length > 0) {
          console.log(`[Carrefour] Results: ${proxyItems.length} items`);
          return proxyItems;
        }
      } catch (err) {
        proxyError = err;
        logCarrefourDebug("Proxy error", err.message);
      }

      if (cfg.mode === "required") {
        console.log("[Carrefour] Results: 0 items");
        if (proxyError)
          logCarrefourDebug("Required mode ended with proxy error");
        continue;
      }
    }

    if (cfg.mode === "off" || cfg.mode === "fallback") {
      try {
        const directItems = await scrapeCarrefourDirect(query);
        logCarrefourDebug("Direct parsed result count", directItems.length);
        if (directItems.length > 0) {
          console.log(`[Carrefour] Results: ${directItems.length} items`);
          return directItems;
        }
      } catch (err) {
        logCarrefourDebug("Direct path error", err.message);
      }
    }

    if (CARREFOUR_MIRROR_FALLBACK) {
      try {
        const mirrorItems = await fetchCarrefourMirrorItems(query);
        if (mirrorItems.length > 0) {
          console.log(`[Carrefour] Results: ${mirrorItems.length} items`);
          return mirrorItems;
        }
      } catch (err) {
        logCarrefourDebug("Mirror path error", err.message);
      }
    }
  }

  console.log("[Carrefour] Results: 0 items");
  return [];
}

async function scrapeSok(product) {
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
      "--disable-software-rasterizer",
      "--hide-scrollbars",
      "--mute-audio",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
  const page = await createConfiguredPage(browser);

  try {
    console.log(`[Sok] Searching for: ${product}`);
    await delay(800 + Math.random() * 800);

    // Try visiting homepage first
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

    // Handle cookie banners
    try {
      await page.evaluate(() => {
        const labels = ["kabul et", "accept", "tamam", "onayla"];
        const nodes = Array.from(document.querySelectorAll("button, a"));
        for (const node of nodes) {
          const text = String(node.textContent || "")
            .trim()
            .toLowerCase();
          if (labels.some((label) => text === label || text.includes(label))) {
            node.click();
          }
        }
      });
      await delay(800);
    } catch (_) {}

    // Wait for product listings
    const contentLoaded = await Promise.race([
      waitForContent(
        page,
        ".product-card, .product-item, [class*='product-card'], [class*='ProductCard'], [class*='product-']",
        8000,
      ),
      new Promise((resolve) => {
        setTimeout(() => resolve(false), 8000);
      }),
    ]);

    // Multiple scroll passes
    await page.evaluate(() => window.scrollBy(0, 800 + Math.random() * 400));
    await delay(1000 + Math.random() * 500);

    await page.evaluate(() => window.scrollBy(0, 800 + Math.random() * 400));
    await delay(1000 + Math.random() * 500);

    // Scroll back up
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

      // Multiple selector strategies
      const selectors = [
        ".product-card",
        ".product-item",
        '[class*="ProductCard"]',
        '[class*="product-card"]',
        '[class*="productCard"]',
        '[class*="product-"]',
        "article",
        '[data-testid*="product"]',
        'a[href*="/urun/"]',
        'a[href*="/product/"]',
      ];

      let nodes = [];
      for (const sel of selectors) {
        const found = document.querySelectorAll(sel);
        if (found.length) {
          nodes = Array.from(found);
          break;
        }
      }
      if (!nodes.length) {
        nodes = Array.from(
          document.querySelectorAll(
            'div[class*="product"], div[class*="Product"]',
          ),
        );
      }

      nodes.forEach((el) => {
        const text = normalize(el.innerText);
        if (text.length < 3) return;
        const price = parsePrice(text);
        if (!Number.isFinite(price) || price <= 0 || price > 5000) return;

        let name = "";
        const nameSelectors = [
          "h2",
          "h3",
          ".name",
          '[class*="name"]',
          '[class*="title"]',
          ".product-name",
        ];
        for (const sel of nameSelectors) {
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
          imgEl?.getAttribute("srcset")?.split(" ")[0] ||
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
    console.log(`[Sok] Results: ${result.length} items`);
    return result;
  } catch (err) {
    console.error(`[Sok] Error:`, err.message);
    return [];
  } finally {
    await browser.close();
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
