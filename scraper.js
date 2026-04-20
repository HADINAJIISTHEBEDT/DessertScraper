const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const NAV_TIMEOUT_MS = 60000;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const IS_CLOUD = Boolean(
  process.env.RENDER ||
  process.env.PORT ||
  process.env.NODE_ENV === "production" ||
  process.env.DYNO,
);

const CARREFOUR_SCRAPER_SERVICE = String(
  process.env.CARREFOUR_SCRAPER_SERVICE || ""
).trim();

const CARREFOUR_DEBUG =
  String(process.env.CARREFOUR_DEBUG || "").trim() === "1";

function logCarrefourDebug(message, extra) {
  if (!CARREFOUR_DEBUG) return;
  console.log(`[Carrefour][Debug] ${message}`, extra || "");
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

  if (/attention required|cloudflare|captcha|security check|blocked/i.test(normalizedHtml)) {
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
      card.match(/js-variant-discounted-price[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ||
      card.match(/price-cont[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ||
      card.match(/class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] ||
      card;

    const price = parsePriceValue(
      String(priceCandidate || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " "),
    );

    const imageMatch = card.match(/<img[^>]+(?:src|data-src|data-lazy)="([^"]+)"/i);
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

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
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
      if (/sepete ekle|kabul et|filtrele|ana sayfa|kampanya|cookie/i.test(candidate)) continue;
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
      '.item.product-card',
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
      if (!name || !Number.isFinite(price) || price <= 0 || price > 5000) return;

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
  if (!CARREFOUR_SCRAPER_SERVICE) {
    throw new Error("CARREFOUR_SCRAPER_SERVICE is missing");
  }

  const targetUrl = `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`;
  const serviceUrl = CARREFOUR_SCRAPER_SERVICE.replace(
    "{URL}",
    encodeURIComponent(targetUrl),
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(serviceUrl, {
      headers: { Accept: "text/html" },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`scraper service HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function scrapeSok(product) {
  const query = improveSearchQuery(product);
  const variants = [query];

  if (query.includes("sut")) variants.push(query.replace("sut", "sÃ¼t"));
  if (query.includes("cilek")) variants.push(query.replace("cilek", "Ã§ilek"));
  if (query.includes("kasar")) variants.push(query.replace("kasar", "kaÅŸar"));

  for (const q of variants) {
    try {
      const url = `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(q)}`;
      const text = await fetchViaJinaReader(url);
      if (/attention required|cloudflare|blocked/i.test(text)) continue;

      const items = parseSokFromJinaText(text);
      if (items.length > 0) return items;
    } catch (err) {
      console.log(`[Sok] Jina error: ${err.message}`);
    }
  }

  return [];
}

async function scrapeCarrefourViaJina(product) {
  const queries = carrefourQueryVariants(product);

  for (const query of queries) {
    try {
      const url = `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`;
      const text = await fetchViaJinaReader(url);
      const items = parseCarrefourHtml(text);
      if (items.length > 0) return items;
    } catch (err) {
      console.log(`[Carrefour] Jina error: ${err.message}`);
    }
  }

  return [];
}

async function scrapeCarrefour(product) {
  const query = improveSearchQuery(product);

  try {
    const items = await scrapeCarrefourViaJina(query);
    if (items.length > 0) return items;
  } catch (err) {
    console.log(`[Carrefour] Jina preflight error: ${err.message}`);
  }

  if (IS_CLOUD) {
    if (!CARREFOUR_SCRAPER_SERVICE) {
      console.log("[Carrefour] Missing scraper service on cloud");
      return [];
    }

    try {
      const html = await fetchCarrefourViaScraperService(query);
      const items = parseCarrefourHtml(html);
      if (items.length > 0) return items;
    } catch (err) {
      console.log(`[Carrefour] Scraper service error: ${err.message}`);
    }

    try {
      const items = await scrapeCarrefourViaJina(query);
      if (items.length > 0) return items;
    } catch (err) {
      console.log(`[Carrefour] Jina fallback error: ${err.message}`);
    }

    return [];
  }

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

    await page.setExtraHTTPHeaders({
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "max-age=0",
      "Upgrade-Insecure-Requests": "1",
    });

    await page.goto(
      `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`,
      { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS },
    );

    await delay(4000);

    const html = await page.content();
    let items = parseCarrefourHtml(html);
    if (items.length > 0) return items;

    items = await extractCarrefourItemsFromPage(page).catch(() => []);
    return items;
  } catch (err) {
    console.log(`[Carrefour] Local puppeteer error: ${err.message}`);
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
  if (market === "sok") return await scrapeSok(product);
  if (market === "carrefour") return await scrapeCarrefour(product);
  return [];
}

async function searchMultiple(product) {
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

