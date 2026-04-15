const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BROWSER_OPTIONS = {
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
  ],
};

async function createPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1440, height: 2200 });
  await page.setExtraHTTPHeaders({
    "accept-language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
  });
  return page;
}

function parsePrice(value) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  const match =
    text.match(/\u20BA\s*([\d.,]+)/) ||
    text.match(/([\d.,]+)\s*TL/i) ||
    text.match(/([\d]+[.,][\d]{2})/);
  if (!match) return null;

  const normalized = String(match[1]).replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeKeyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeValidProductName(value) {
  const name = String(value || "").replace(/\s+/g, " ").trim();
  if (name.length < 3) return false;
  if (/^[\d\s.,]+(?:tl)?$/i.test(name)) return false;
  if (/^(adet|indirim|sepete|ekle|incele|kampanya)$/i.test(name)) return false;
  return /[\p{L}]/u.test(name);
}

function itemScore(item) {
  let score = 0;
  if (item.image) score += 3;
  if (item.name && item.name.length >= 12) score += 2;
  if (item.name && /\d/.test(item.name)) score += 1;
  return score;
}

function dedupeItems(items) {
  const byKey = new Map();

  for (const rawItem of Array.isArray(items) ? items : []) {
    const item = {
      market: rawItem.market,
      name: String(rawItem.name || "").replace(/\s+/g, " ").trim(),
      price: Number(rawItem.price),
      image: String(rawItem.image || "").trim(),
    };

    if (!looksLikeValidProductName(item.name)) continue;
    if (!Number.isFinite(item.price) || item.price <= 0) continue;

    const key = `${normalizeKeyName(item.name)}|${item.price.toFixed(2)}`;
    const existing = byKey.get(key);
    if (!existing || itemScore(item) > itemScore(existing)) {
      byKey.set(key, item);
    }
  }

  return [...byKey.values()];
}

function withTurkishVariants(product) {
  const raw = String(product || "").trim().toLowerCase();
  if (!raw) return [];

  const asciiToTurkish = {
    c: "\u00E7",
    g: "\u011F",
    i: "\u0131",
    o: "\u00F6",
    s: "\u015F",
    u: "\u00FC",
  };

  const variants = new Set([raw]);
  let converted = "";
  for (const char of raw) converted += asciiToTurkish[char] || char;
  variants.add(converted);

  if (raw.includes("sut")) variants.add("s\u00FCt");
  if (raw.includes("yogurt")) variants.add("yo\u011Furt");
  if (raw.includes("peynir")) variants.add("peynir");

  return [...variants].filter(Boolean);
}

async function collectPageItems(page, market) {
  return await page.evaluate((marketName) => {
    const normalizeName = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const looksLikeValidName = (value) => {
      const name = normalizeName(value);
      if (name.length < 3) return false;
      if (/^[\d\s.,]+(?:tl)?$/i.test(name)) return false;
      if (/^(adet|indirim|sepete|ekle|incele|kampanya)$/i.test(name)) return false;
      return /[A-Za-z\u00C0-\u024F\u0130\u0131\u015E\u015F\u011E\u011F\u00D6\u00F6\u00DC\u00FC\u00C7\u00E7]/.test(name);
    };
    const parseTextPrice = (value) => {
      const text = String(value || "");
      const match =
        text.match(/\u20BA\s*([\d.,]+)/) ||
        text.match(/([\d.,]+)\s*TL/i) ||
        text.match(/([\d]+[.,][\d]{2})/);
      if (!match) return null;
      const parsed = Number.parseFloat(String(match[1]).replace(/\./g, "").replace(",", "."));
      return Number.isFinite(parsed) ? parsed : null;
    };

    const items = [];
    const seen = new Set();

    const pushItem = (name, price, image) => {
      const cleanName = normalizeName(name);
      const parsedPrice = Number(price);
      const cleanImage = String(image || "").trim();
      if (!looksLikeValidName(cleanName)) return;
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) return;

      const key = `${cleanName.toLowerCase()}|${parsedPrice.toFixed(2)}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ market: marketName, name: cleanName, price: parsedPrice, image: cleanImage });
    };

    const candidateSelectors = [
      "[data-testid*='product']",
      "article",
      "a[href*='/urun/']",
      "a[href*='/product/']",
      "a[href*='/p/']",
      ".product-card",
      ".product-item",
      "[class*='product-card']",
      "[class*='product-item']",
      "[class*='product']",
    ];

    const candidates = [];
    for (const selector of candidateSelectors) {
      document.querySelectorAll(selector).forEach((el) => candidates.push(el));
    }

    for (const el of candidates) {
      const text = normalizeName(el.innerText);
      if (text.length < 5) continue;

      const price = parseTextPrice(text);
      if (!price) continue;

      let name = "";
      const nameSelectors = [
        "[class*='name']",
        "[class*='title']",
        "[class*='desc']",
        "h1",
        "h2",
        "h3",
        "h4",
        "strong",
      ];
      for (const selector of nameSelectors) {
        const node = el.querySelector(selector);
        if (!node?.innerText) continue;
        const value = normalizeName(node.innerText);
        if (looksLikeValidName(value) && !value.includes("\u20BA")) {
          name = value;
          break;
        }
      }

      if (!looksLikeValidName(name)) {
        const lines = text
          .split(/\n|\u20BA|TL/i)
          .map(normalizeName)
          .filter(looksLikeValidName)
          .sort((a, b) => b.length - a.length);
        name = lines[0] || "";
      }

      const imgEl = el.querySelector("img");
      const image = imgEl
        ? imgEl.currentSrc ||
          imgEl.src ||
          imgEl.getAttribute("data-src") ||
          imgEl.getAttribute("data-lazy") ||
          imgEl.getAttribute("srcset") ||
          ""
        : "";

      pushItem(name, price, image);
    }

    const visitJsonLikeNode = (node) => {
      if (!node || typeof node !== "object") return;

      const name =
        node.name ||
        node.title ||
        node.productName ||
        node.displayName ||
        node.brandName;
      const price =
        node.salePrice ||
        node.finalPrice ||
        node.price ||
        node.discountedPrice ||
        node.listPrice ||
        node.priceValue;
      const image =
        node.image ||
        node.imageUrl ||
        node.imageURL ||
        node.image_url ||
        node.images?.[0]?.url ||
        node.images?.[0];

      if (name && price) {
        pushItem(name, parseTextPrice(price) ?? Number(price), image);
      }

      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visitJsonLikeNode);
        else if (value && typeof value === "object") visitJsonLikeNode(value);
      }
    };

    const nextDataScript = document.querySelector("#__NEXT_DATA__");
    if (nextDataScript?.textContent) {
      try {
        visitJsonLikeNode(JSON.parse(nextDataScript.textContent));
      } catch (_) {}
    }

    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      if (!script.textContent) return;
      try {
        visitJsonLikeNode(JSON.parse(script.textContent));
      } catch (_) {}
    });

    if (items.length === 0) {
      const scriptTexts = Array.from(document.querySelectorAll("script"))
        .map((script) => script.textContent || "")
        .join("\n");

      const pairRegex =
        /"(?:name|title|productName)"\s*:\s*"([^"]{3,220})"[\s\S]{0,500}?"(?:salePrice|finalPrice|price|discountedPrice)"\s*:\s*"?([\d.,]+)"?[\s\S]{0,500}?"(?:image|imageUrl|imageURL)"\s*:\s*"([^"]*)"/g;

      let match;
      while ((match = pairRegex.exec(scriptTexts)) !== null) {
        pushItem(match[1], parseTextPrice(match[2]) ?? Number(match[2]), match[3]);
      }
    }

    return items;
  }, market);
}

async function scrapeSok(product) {
  const browser = await puppeteer.launch(BROWSER_OPTIONS);
  const page = await createPage(browser);

  try {
    console.log(`[Sok] Searching for: ${product}`);
    await page.goto(`https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(product)}`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await delay(3000);
    await page.evaluate(() => window.scrollBy(0, 1000));
    await delay(1500);

    const deduped = dedupeItems(await collectPageItems(page, "Sok"));
    console.log(`[Sok] Results:`, deduped.length, "items");
    return deduped.slice(0, 20);
  } catch (err) {
    console.error(`[Sok] Error:`, err.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeCarrefour(product) {
  const queries = withTurkishVariants(product);

  for (const query of queries) {
    const browser = await puppeteer.launch(BROWSER_OPTIONS);
    const page = await createPage(browser);

    try {
      console.log(`[Carrefour] Searching for: ${query}`);
      await page.goto(`https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      await delay(4000);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await delay(1500);
      await page.waitForSelector("body", { timeout: 5000 });

      const deduped = dedupeItems(await collectPageItems(page, "Carrefour"));
      console.log(`[Carrefour] Results:`, deduped.length, "items");
      if (deduped.length > 0) return deduped.slice(0, 20);
    } catch (err) {
      console.error(`[Carrefour] Error:`, err.message);
    } finally {
      await browser.close();
    }
  }

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
      scrapeSok(name).catch((err) => {
        console.error(`[Compare][Sok] ${name}:`, err.message);
        return [];
      }),
      scrapeCarrefour(name).catch((err) => {
        console.error(`[Compare][Carrefour] ${name}:`, err.message);
        return [];
      }),
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
  if (market === "sok") return await scrapeSok(product).catch(() => []);
  if (market === "carrefour") return await scrapeCarrefour(product).catch(() => []);
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
