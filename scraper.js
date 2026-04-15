const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const NAV_TIMEOUT_MS = 45000;
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
    console.log(`[Sok] Results:`, result.length, "items");
    return result;
  } catch (err) {
    console.error(`[Sok] Error:`, err.message);
    return [];
  } finally {
    await browser.close();
  }
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

async function extractCarrefourItems(page) {
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

async function scrapeCarrefourSingleQuery(query) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    // First attempt: static HTML mode (JS disabled). Often works better on Render.
    const staticPage = await browser.newPage();
    await staticPage.setJavaScriptEnabled(false);
    await staticPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    );
    await staticPage.setViewport({ width: 1440, height: 2200 });
    await staticPage.setExtraHTTPHeaders({
      "accept-language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    });
    await staticPage.goto(
      `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`,
      { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS },
    );
    await delay(1200);
    const staticItems = await extractCarrefourItems(staticPage);
    if (staticItems.length > 0) return staticItems;

    // Second attempt: JS enabled + small scrolls + cookie click
    const page = await createConfiguredPage(browser);
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
    return await extractCarrefourItems(page);
  } finally {
    await browser.close();
  }
}

async function scrapeCarrefour(product) {
  try {
    const queries = carrefourQueryVariants(product);
    for (const query of queries) {
      console.log(`[Carrefour] Searching for: ${query}`);
      const items = await scrapeCarrefourSingleQuery(query);
      if (items.length > 0) {
        console.log(`[Carrefour] Results: ${items.length} items`);
        return items;
      }
    }
    console.log("[Carrefour] Results: 0 items");
    return [];
  } catch (err) {
    console.error(`[Carrefour] Error:`, err.message);
    return [];
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

module.exports = { compareIngredients, searchProduct, searchMultiple };
