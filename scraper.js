const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const NAV_TIMEOUT_MS = 45000;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CARREFOUR_PROXY_MODE = String(process.env.CARREFOUR_PROXY_MODE || "off")
  .trim()
  .toLowerCase();
const CARREFOUR_PROXY_ENDPOINT = String(process.env.CARREFOUR_PROXY_ENDPOINT || "").trim();
const CARREFOUR_PROXY_API_KEY = String(process.env.CARREFOUR_PROXY_API_KEY || "").trim();
const CARREFOUR_PROXY_REGION = String(process.env.CARREFOUR_PROXY_REGION || "TR").trim();
const CARREFOUR_PROXY_TIMEOUT_MS = Number.parseInt(
  process.env.CARREFOUR_PROXY_TIMEOUT_MS || "30000",
  10,
);
const CARREFOUR_DEBUG = String(process.env.CARREFOUR_DEBUG || "").trim() === "1";

function logCarrefourDebug(message, extra) {
  if (!CARREFOUR_DEBUG) return;
  if (extra === undefined) {
    console.log(`[Carrefour][Debug] ${message}`);
  } else {
    console.log(`[Carrefour][Debug] ${message}`, extra);
  }
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parsePriceValue(text) {
  if (!text) return null;
  const str = String(text);
  const match =
    str.match(/\u20BA\s*([\d.,]+)/) ||
    str.match(/([\d.,]+)\s*(TL|\u20BA)/i) ||
    str.match(/([\d]+[.,]\d{2})/);
  if (!match) return null;
  const parsed = Number.parseFloat(String(match[1]).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function dedupeItems(items) {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const name = normalizeText(item.name);
    const price = Number(item.price);
    const image = normalizeText(item.image);
    if (!name || name.length < 3) continue;
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
  const source = String(product || "").trim().toLowerCase();
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
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  );
  await page.setViewport({ width: 1440, height: 2200 });
  await page.setExtraHTTPHeaders({
    "accept-language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
  });
  return page;
}

async function gotoFast(page, url) {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: NAV_TIMEOUT_MS,
  });
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
      if (item && typeof item.html === "string" && item.html.includes("<html")) return item.html;
      if (item && typeof item.content === "string" && item.content.includes("<html"))
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
  const timeout = setTimeout(() => controller.abort(), Math.max(5000, CARREFOUR_PROXY_TIMEOUT_MS));
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

    logCarrefourDebug("Proxy response html snippet", html.slice(0, 180).replace(/\s+/g, " "));
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

  const cardRegex =
    /<li[^>]*class="[^"]*product-listing-item[^"]*"[^>]*>[\s\S]*?<\/li>/gi;
  const cards = normalizedHtml.match(cardRegex) || [];

  for (const card of cards) {
    const nameMatch =
      card.match(/<h3[^>]*class="[^"]*item-name[^"]*"[^>]*>([\s\S]*?)<\/h3>/i) ||
      card.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i);
    const name = normalizeText(
      (nameMatch?.[1] || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " "),
    );

    const priceCandidate =
      card.match(/js-variant-discounted-price[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ||
      card.match(/price-cont[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ||
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
      if (!candidate || candidate.length < 3) continue;
      if (parsePriceValue(candidate)) continue;
      if (/sepete ekle|kabul et|filtrele|ana sayfa|kampanya/i.test(candidate)) continue;
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
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const parsePrice = (text) => {
      const str = String(text || "");
      const match =
        str.match(/\u20BA\s*([\d.,]+)/) ||
        str.match(/([\d.,]+)\s*(TL|\u20BA)/i) ||
        str.match(/([\d]+[.,]\d{2})/);
      if (!match) return null;
      return Number.parseFloat(String(match[1]).replace(/\./g, "").replace(",", "."));
    };

    const cards = document.querySelectorAll(
      ".product-listing-item, .item.product-card, [class*='product-listing-item'], [class*='product-card'], li[class*='product']",
    );

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
        const firstLine = rawText.split("\n").map((s) => s.trim()).find((s) => s.length > 2) || "";
        name = normalize(firstLine);
      }

      const priceText =
        `${card.querySelector(".js-variant-discounted-price")?.textContent || ""} ` +
        `${card.querySelector(".price-cont")?.textContent || ""} ` +
        `${card.querySelector(".item-price")?.textContent || ""} ` +
        rawText;
      const price = parsePrice(priceText);
      if (!name || !Number.isFinite(price) || price <= 0 || price > 5000) return;

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
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await createConfiguredPage(browser);

  try {
    await gotoFast(page, `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`);
    await delay(1600);

    await page
      .evaluate(() => {
        const labels = ["kabul et", "accept", "tamam", "onayla"];
        const nodes = Array.from(document.querySelectorAll("button, a, span"));
        for (const node of nodes) {
          const text = String(node.textContent || "").trim().toLowerCase();
          if (labels.some((label) => text === label || text.includes(label))) {
            node.click();
          }
        }
      })
      .catch(() => {});

    for (let i = 0; i < 3; i += 1) {
      await page.evaluate(() => window.scrollBy(0, 1100));
      await delay(700);
    }

    const items = await extractCarrefourItemsFromPage(page);
    if (items.length > 0) return items;

    // Fallback parse from full HTML snapshot.
    const html = await page.content();
    return parseCarrefourHtml(html);
  } finally {
    await browser.close();
  }
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
        if (proxyError) logCarrefourDebug("Required mode ended with proxy error");
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
  }

  console.log("[Carrefour] Results: 0 items");
  return [];
}

async function scrapeSok(product) {
  console.log(`[Sok] Disabled for testing. Skipping query: ${product}`);
  return [];
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

    const sokItem = Array.isArray(sokItems) && sokItems.length > 0 ? sokItems[0] : null;
    const carrefourItem =
      Array.isArray(carrefourItems) && carrefourItems.length > 0 ? carrefourItems[0] : null;

    const sokUnit = sokItem ? Number(sokItem.price) : null;
    const carrefourUnit = carrefourItem ? Number(carrefourItem.price) : null;

    const sokCost = sokUnit !== null && Number.isFinite(sokUnit) ? sokUnit * quantity : null;
    const carrefourCost =
      carrefourUnit !== null && Number.isFinite(carrefourUnit) ? carrefourUnit * quantity : null;

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

module.exports = { compareIngredients, searchProduct, searchMultiple, parseCarrefourHtml };
