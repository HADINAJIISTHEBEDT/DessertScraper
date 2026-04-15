const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

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

function parsePriceValue(txt) {
  if (!txt) return null;
  const m =
    txt.match(/₺\s*([\d.,]+)/) ||
    txt.match(/([\d.,]+)\s*(TL|₺)/i) ||
    txt.match(/([\d]+[.,][\d]{2})/);
  if (!m) return null;
  const val = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isNaN(val) ? null : val;
}

async function scrapeSok(product) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await createConfiguredPage(browser);
  try {
    console.log(`[Sok] Searching for: ${product}`);
    await page.goto(
      `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(product)}`,
      {
        waitUntil: "networkidle2",
        timeout: 60000,
      },
    );
    await delay(3000);
    await page.evaluate(() => window.scrollBy(0, 1000));
    await delay(1500);

    const result = await page.evaluate(() => {
      const parsePrice = (txt) => {
        const m =
          txt.match(/₺\s*([\d.,]+)/) ||
          txt.match(/([\d.,]+)\s*(TL|₺)/i) ||
          txt.match(/([\d]+[.,][\d]{2})/);
        if (!m) return null;
        const val = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
        return Number.isNaN(val) ? null : val;
      };

      const items = [];
      const seen = new Set();

      const selectors = [
        ".product-card",
        ".product-item",
        '[class*="ProductCard"]',
        '[class*="product-"]',
        "article",
        '[data-testid*="product"]',
      ];

      let foundElements = [];
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          foundElements = Array.from(elements);
          break;
        }
      }

      if (foundElements.length === 0) {
        foundElements = Array.from(
          document.querySelectorAll(
            'div[class*="product"], div[class*="Product"]',
          ),
        );
      }

      foundElements.forEach((el) => {
        const text = (el.innerText || "").trim();
        if (!text || text.length < 3) return;
        const price = parsePrice(text);
        if (!price || price < 0.1) return;

        let name = "";
        let image = "";

        const nameSelectors = [
          "h2",
          "h3",
          ".name",
          '[class*="name"]',
          '[class*="title"]',
        ];
        for (const sel of nameSelectors) {
          const nameEl = el.querySelector(sel);
          if (nameEl && nameEl.innerText) {
            name = nameEl.innerText.trim();
            break;
          }
        }

        const imgEl = el.querySelector("img");
        if (imgEl && imgEl.src) {
          image = imgEl.src;
        }

        if (!name) {
          name = text.split("\n")[0].trim();
        }

        if (name && name.length > 2) {
          const key = name.toLowerCase() + "|" + price;
          if (!seen.has(key)) {
            seen.add(key);
            items.push({ market: "Sok", name, price, image });
          }
        }
      });

      return items;
    });

    console.log(`[Sok] Results:`, result?.length || 0, "items");
    await browser.close();
    return result;
  } catch (err) {
    console.error(`[Sok] Error:`, err.message);
    await browser.close();
    return [];
  }
}

async function scrapeCarrefour(product) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await createConfiguredPage(browser);
  try {
    console.log(`[Carrefour] Searching for: ${product}`);
    await page.goto(
      `https://www.carrefoursa.com/search/?q=${encodeURIComponent(product)}`,
      {
        waitUntil: "networkidle2",
        timeout: 60000,
      },
    );
    await delay(4000);
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight / 2),
    );
    await delay(1500);

    const result = await page.evaluate(() => {
      const parsePrice = (txt) => {
        const m = txt.match(/[₺]?\s*([\d]+[.,]\d{2})/);
        if (m) return parseFloat(m[1].replace(",", "."));
        const m2 = txt.match(/([\d]+)\s*[₺]/);
        if (m2) return parseFloat(m2[1]);
        return null;
      };

      const items = [];
      const seen = new Set();

      document
        .querySelectorAll(
          'a[href*="/p/"], article[class*="product"], [class*="product-card"], [class*="product-item"], li[class*="product"]',
        )
        .forEach((el) => {
          const text = (el.innerText || "").replace(/\s+/g, " ").trim();
          if (text.length < 5) return;

          const price = parsePrice(text);

          let name = "";
          let image = "";

          const nameEl = el.querySelector(
            '[class*="name"], [class*="title"], h2, h3, h4, [class*="product-name"]',
          );
          if (nameEl) {
            name = (nameEl.innerText || "").trim();
          }

          if (!name || name.length < 3) {
            const lines = text
              .split("\n")
              .filter((l) => l.trim().length > 3 && !l.match(/^\d+[,.]?\d*$/));
            name = lines[0] || "";
          }

          const imgEl = el.querySelector("img");
          if (imgEl) {
            const src =
              imgEl.src ||
              imgEl.getAttribute("data-src") ||
              imgEl.getAttribute("data-lazy") ||
              imgEl.getAttribute("srcset")?.split(" ")[0] ||
              "";
            if (src && !src.includes("data:") && src.length > 20) {
              image = src;
            }
          }

          if (name && name.length > 3 && price && price > 0 && price < 5000) {
            const key = name.toLowerCase().substring(0, 25);
            if (!seen.has(key)) {
              seen.add(key);
              items.push({ market: "Carrefour", name, price, image });
            }
          }
        });

      return items.slice(0, 10);
    });

    console.log(`[Carrefour] Results:`, result?.length || 0, "items");
    await browser.close();
    return result;
  } catch (err) {
    console.error(`[Carrefour] Error:`, err.message);
    await browser.close();
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
      scrapeSok(name),
      scrapeCarrefour(name),
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

  const totals = {
    sok: sokTotal,
    carrefour: carrefourTotal,
  };
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
