const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const NAV_TIMEOUT_MS = 45000;
const MIN_PRICE = 0.1;
const MAX_PRICE = 5000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  if (!Number.isFinite(parsed)) return null;
  if (parsed < MIN_PRICE || parsed > MAX_PRICE) return null;
  return parsed;
}

function isLikelyName(name) {
  const value = normalizeText(name);
  if (value.length < 3) return false;
  if (/^[\d\s.,]+(?:tl)?$/i.test(value)) return false;
  if (/^(sepete ekle|kampanya|in stock)$/i.test(value)) return false;
  return /[\p{L}]/u.test(value);
}

function dedupeItems(items) {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const name = normalizeText(item.name);
    const price = Number(item.price);
    const image = normalizeText(item.image);
    if (!isLikelyName(name)) continue;
    if (!Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) continue;
    const key = `${name.toLowerCase()}|${price.toFixed(2)}`;
    if (!map.has(key)) {
      map.set(key, { market: item.market, name, price, image });
      continue;
    }
    const existing = map.get(key);
    if (!existing.image && image) map.set(key, { market: item.market, name, price, image });
  }
  return [...map.values()];
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
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
}

async function scrapeSok(product) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await createConfiguredPage(browser);

  try {
    console.log(`[Sok] Searching for: ${product}`);
    await gotoFast(page, `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(product)}`);
    await delay(2200);
    await page.evaluate(() => window.scrollBy(0, 1200));
    await delay(900);

    const items = await page.evaluate(() => {
      const parsePrice = (text) => {
        const str = String(text || "");
        const match =
          str.match(/\u20BA\s*([\d.,]+)/) ||
          str.match(/([\d.,]+)\s*(TL|\u20BA)/i) ||
          str.match(/([\d]+[.,]\d{2})/);
        if (!match) return null;
        return Number.parseFloat(String(match[1]).replace(/\./g, "").replace(",", "."));
      };
      const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const out = [];
      const seen = new Set();

      const selectors = [
        ".product-card",
        ".product-item",
        '[class*="ProductCard"]',
        '[class*="product-"]',
        "article",
        '[data-testid*="product"]',
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
        nodes = Array.from(document.querySelectorAll('div[class*="product"], div[class*="Product"]'));
      }

      nodes.forEach((el) => {
        const text = normalize(el.innerText);
        if (text.length < 4) return;
        const price = parsePrice(text);
        if (!Number.isFinite(price) || price <= 0) return;

        let name = "";
        const nameSelectors = ["h2", "h3", ".name", '[class*="name"]', '[class*="title"]'];
        for (const sel of nameSelectors) {
          const nameEl = el.querySelector(sel);
          if (nameEl?.innerText) {
            name = normalize(nameEl.innerText);
            if (name) break;
          }
        }
        if (!name) {
          name = normalize((el.innerText || "").split("\n")[0]);
        }

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
    console.log(`[Sok] Results:`, result.length, "items");
    return result;
  } catch (err) {
    console.error(`[Sok] Error:`, err.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function extractCarrefourByCards(page) {
  return await page.evaluate(() => {
    const parsePrice = (text) => {
      const str = String(text || "");
      const match =
        str.match(/\u20BA\s*([\d.,]+)/) ||
        str.match(/([\d.,]+)\s*(TL|\u20BA)/i) ||
        str.match(/([\d]+[.,]\d{2})/);
      if (!match) return null;
      return Number.parseFloat(String(match[1]).replace(/\./g, "").replace(",", "."));
    };
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();

    const items = [];
    const seen = new Set();
    const cards = document.querySelectorAll(
      '.product-listing-item, a[href*="/-p-"], a[href*="/p/"], article[class*="product"], [class*="product-card"], [class*="product-item"], li[class*="product"]',
    );

    cards.forEach((el) => {
      const rawText = String(el.innerText || "").trim();
      if (!rawText) return;

      const name =
        normalize(el.querySelector(".item-name")?.textContent) ||
        normalize(el.querySelector('[class*="name"]')?.textContent) ||
        normalize(el.querySelector('[class*="title"]')?.textContent) ||
        normalize(rawText.split("\n")[0]);

      const priceText =
        `${el.querySelector(".js-variant-discounted-price")?.textContent || ""} ` +
        `${el.querySelector(".price-cont")?.textContent || ""} ` +
        `${rawText}`;
      const price = parsePrice(priceText);

      const imgEl = el.querySelector("img");
      const image =
        imgEl?.currentSrc ||
        imgEl?.src ||
        imgEl?.getAttribute("data-src") ||
        imgEl?.getAttribute("data-lazy") ||
        imgEl?.getAttribute("srcset")?.split(" ")[0] ||
        "";

      if (!name || !Number.isFinite(price) || price <= 0) return;
      const key = `${name.toLowerCase()}|${price.toFixed(2)}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ market: "Carrefour", name, price, image });
      }
    });

    return items;
  });
}

async function extractCarrefourByBodyText(page) {
  return await page.evaluate(() => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const parsePrice = (value) => {
      const match =
        String(value || "").match(/\u20BA\s*([\d.,]+)/) ||
        String(value || "").match(/([\d.,]+)\s*(TL|\u20BA)/i) ||
        String(value || "").match(/([\d]+[.,]\d{2})/);
      if (!match) return null;
      return Number.parseFloat(String(match[1]).replace(/\./g, "").replace(",", "."));
    };

    const text = String(document.body?.innerText || "");
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const items = [];
    const seen = new Set();

    for (let i = 0; i < lines.length - 1; i += 1) {
      const line = lines[i];
      const next = lines[i + 1];
      const price = parsePrice(line) || parsePrice(next);
      if (!price) continue;

      // Look back up to 3 lines for a likely product name.
      let name = "";
      for (let b = 1; b <= 3; b += 1) {
        const candidate = lines[i - b];
        if (!candidate) continue;
        if (/sepete ekle/i.test(candidate)) continue;
        if (parsePrice(candidate)) continue;
        if (candidate.length < 3) continue;
        name = normalize(candidate);
        break;
      }
      if (!name) continue;

      const key = `${name.toLowerCase()}|${price.toFixed(2)}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ market: "Carrefour", name, price, image: "" });
      }
    }
    return items;
  });
}

function addTurkishQueryVariants(product) {
  const q = String(product || "").trim().toLowerCase();
  if (!q) return [];
  const variants = new Set([q]);
  if (q.includes("sut")) variants.add("süt");
  if (q.includes("yogurt")) variants.add("yoğurt");
  if (q.includes("cilek")) variants.add("çilek");
  return [...variants];
}

async function scrapeCarrefour(product) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await createConfiguredPage(browser);

  try {
    const queries = addTurkishQueryVariants(product);
    for (const query of queries) {
      console.log(`[Carrefour] Searching for: ${query}`);
      await gotoFast(page, `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`);
      await delay(2200);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await delay(900);

      const byCards = dedupeItems(await extractCarrefourByCards(page));
      if (byCards.length > 0) {
        console.log(`[Carrefour] Results:`, byCards.length, "items");
        return byCards;
      }

      const byText = dedupeItems(await extractCarrefourByBodyText(page));
      if (byText.length > 0) {
        console.log(`[Carrefour] Results:`, byText.length, "items");
        return byText;
      }
    }

    console.log("[Carrefour] Results: 0 items");
    return [];
  } catch (err) {
    console.error(`[Carrefour] Error:`, err.message);
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
  const hasSok = rows.some((r) => r.sok.unitPrice !== null);
  const hasCarrefour = rows.some((r) => r.carrefour.unitPrice !== null);

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

module.exports = { compareIngredients, searchProduct, searchMultiple };
