const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const IS_CLOUD = Boolean(
  process.env.RENDER ||
  process.env.PORT ||
  process.env.NODE_ENV === "production"
);

// 🔥 REQUIRED for Carrefour on Render
const CARREFOUR_SCRAPER_SERVICE = String(
  process.env.CARREFOUR_SCRAPER_SERVICE || ""
).trim();

// ------------------ HELPERS ------------------

function normalizeText(v) {
  return String(v || "").replace(/\s+/g, " ").trim();
}

function improveSearchQuery(q) {
  return String(q || "")
    .toLowerCase()
    .replace("milk", "süt")
    .replace("cheese", "peynir")
    .replace("yogurt", "yoğurt")
    .trim();
}

function parsePrice(text) {
  if (!text) return null;
  const m =
    text.match(/([\d]+[.,]\d{2})\s*(₺|TL)/i) ||
    text.match(/(₺)\s*([\d]+[.,]\d{2})/) ||
    text.match(/([\d]+[.,]\d{2})/);
  if (!m) return null;
  const val = m[1] || m[2];
  return parseFloat(val.replace(",", "."));
}

function dedupe(items) {
  const map = new Map();
  for (const i of items) {
    if (!i.name || !i.price) continue;
    const key = i.name.toLowerCase() + i.price;
    if (!map.has(key)) map.set(key, i);
  }
  return [...map.values()];
}

// ------------------ ŞOK ------------------

async function fetchJina(url) {
  const res = await fetch(`https://r.jina.ai/${url}`);
  return await res.text();
}

function parseSok(text) {
  const items = [];
  const regex =
    /\[!\[Image.*?\]\((.*?)\).*?## (.*?) (\d+,\d+)₺/g;

  let m;
  while ((m = regex.exec(text))) {
    items.push({
      market: "Sok",
      name: normalizeText(m[2]),
      price: parseFloat(m[3].replace(",", ".")),
      image: m[1],
    });
  }
  return dedupe(items);
}

async function scrapeSok(product) {
  const query = improveSearchQuery(product);
  try {
    const url = `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(query)}`;
    const text = await fetchJina(url);
    return parseSok(text);
  } catch {
    return [];
  }
}

// ------------------ CARREFOUR ------------------

async function fetchCarrefourViaAPI(query) {
  const target = `https://www.carrefoursa.com/search/?q=${encodeURIComponent(query)}`;
  const url = CARREFOUR_SCRAPER_SERVICE.replace(
    "{URL}",
    encodeURIComponent(target)
  );

  const res = await fetch(url);
  return await res.text();
}

function parseCarrefour(html) {
  const items = [];
  const seen = new Set();

  const cards =
    html.match(/data-testid="product-card"[\s\S]*?<\/li>/g) || [];

  for (const c of cards) {
    const name =
      c.match(/<h3.*?>(.*?)<\/h3>/)?.[1] ||
      c.match(/<h2.*?>(.*?)<\/h2>/)?.[1];

    const price = parsePrice(c);

    const img = c.match(/<img.*?src="(.*?)"/)?.[1];

    if (!name || !price) continue;

    const key = name + price;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      market: "Carrefour",
      name: normalizeText(name.replace(/<.*?>/g, "")),
      price,
      image: img || "",
    });
  }

  return dedupe(items);
}

async function scrapeCarrefour(product) {
  const query = improveSearchQuery(product);

  // 🔴 CLOUD (Render) → MUST use API
  if (IS_CLOUD) {
    if (!CARREFOUR_SCRAPER_SERVICE) {
      console.log("❌ Missing CARREFOUR_SCRAPER_SERVICE");
      return [];
    }

    try {
      const html = await fetchCarrefourViaAPI(query);
      return parseCarrefour(html);
    } catch {
      return [];
    }
  }

  // 🟢 LOCALHOST only
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(
      `https://www.carrefoursa.com/search/?q=${query}`,
      { waitUntil: "domcontentloaded" }
    );

    await delay(3000);

    const items = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("[data-testid='product-card']").forEach((el) => {
        const name = el.innerText.split("\n")[0];
        const priceText = el.innerText;
        const match = priceText.match(/(\d+,\d+)/);

        if (!match) return;

        out.push({
          market: "Carrefour",
          name,
          price: parseFloat(match[1].replace(",", ".")),
          image: el.querySelector("img")?.src || "",
        });
      });
      return out;
    });

    await browser.close();
    return dedupe(items);
  } catch {
    return [];
  }
}

// ------------------ MAIN ------------------

async function searchMultiple(product) {
  const [sok, carrefour] = await Promise.all([
    scrapeSok(product),
    scrapeCarrefour(product),
  ]);

  return { sok, carrefour };
}

async function searchProduct(product, market) {
  if (market === "sok") return scrapeSok(product);
  if (market === "carrefour") return scrapeCarrefour(product);
  return [];
}

async function compareIngredients(ingredients) {
  const rows = [];
  let sokTotal = 0;
  let carrefourTotal = 0;

  for (const ing of ingredients) {
    const sok = await scrapeSok(ing.name);
    const carrefour = await scrapeCarrefour(ing.name);

    const s = sok[0];
    const c = carrefour[0];

    const sokCost = s ? s.price * ing.quantity : 0;
    const carrefourCost = c ? c.price * ing.quantity : 0;

    sokTotal += sokCost;
    carrefourTotal += carrefourCost;

    rows.push({
      name: ing.name,
      sok: sokCost,
      carrefour: carrefourCost,
    });
  }

  return {
    rows,
    totals: {
      sok: sokTotal,
      carrefour: carrefourTotal,
    },
  };
}

module.exports = {
  searchMultiple,
  searchProduct,
  compareIngredients,
};