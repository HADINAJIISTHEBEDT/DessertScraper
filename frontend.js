// ============================================================
// DESSERT CAFE MANAGER - FRONTEND JAVASCRIPT
// Works on Netlify with serverless functions
// ============================================================

const PORTS_TO_TRY = [
  15050, 15051, 15052, 15053, 18080, 13000, 5050, 5051, 5052, 5053, 8080, 3000,
];
let SCRAPER_API_BASE = null;
const AUTO_EMAIL = "5000";
const AUTO_PASSWORD = "5000";
const LOCAL_KEY = "desserts_offline_data_v2";

// ─── Backend Configuration ─────────────────────────────────────────────────
// For Netlify: API calls go to /.netlify/functions/api
// For local development: tries to find local server or uses current origin

// ─── Language System ─────────────────────────────────────────────────────────

let currentLang = localStorage.getItem("app_lang") || "en";

const translations = {
  en: {
    // Login
    loginTitle: "Login",
    email: "Email",
    password: "Password",
    loginBtn: "Login / Register",
    loginError: "Use email 5000 and password 5000",

    // Header
    appTitle: "Dessert Cafe Manager",

    // Navigation
    timerTab: "Timer",
    marketTab: "Market Prices",
    settingsTab: "Settings",

    // Timer Tab
    activeDesserts: "Active Desserts",
    expiredDesserts: "Expired Desserts",
    startBtn: "Start",
    resetBtn: "Reset",
    timeFinished: "Time finished for",

    // Market Tab
    marketPrices: "Market Prices",
    dessert: "Dessert",
    findCheapestBtn: "Find Cheapest Market",
    marketHint: "Uses ingredient quantities from Settings.",
    ingredient: "Ingredient",
    qty: "Qty",
    unit: "Unit",
    cost: "Cost",
    best: "Best",
    totalSok: "Total Şok",
    totalCarrefour: "Total Carrefour",
    cheapestMarket: "Cheapest Market",
    searching: "Searching Şok and Carrefour, please wait…",
    selectDessert: "Please select a dessert.",
    addIngredientsFirst: "Please add ingredients in Settings first.",
    marketServiceError: "Market service error",

    // Settings Tab
    timerSettings: "Timer Settings",
    days: "days",
    hours: "hours",
    minutes: "minutes",
    saveBtn: "Save",
    deleteBtn: "🗑 Delete",
    addNewDessertBtn: "+ Add New Dessert",
    ingredientsTitle: "Ingredients and Quantity",
    addIngredientBtn: "+ Add Ingredient",

    // Ingredient Form
    ingredientName: "Ingredient",
    description: "Description / Brand",
    need: "Need",
    perPackage: "per package:",
    packSize: "Pack size",
    pickFromMarket: "🛒 Pick from Market",
    openSok: "Open Şok",
    openCarrefour: "Open Carrefour",

    // Validation
    ingredientNameRequired: "Ingredient name is required.",
    quantityMustBeGreater: "Needed quantity must be greater than 0.",
    packageSizeMustBeGreater: "Package size must be greater than 0.",
    ingredientSaved: "Ingredient saved.",
    noIngredientsYet: "No ingredients yet.",
    writeIngredientFirst: "Write ingredient name first.",

    // Pick Modal
    pickItemFromMarket: "🛒 Pick Item from Market",
    typeProductName: "Type product name and press Enter…",
    searchBtn: "Search",
    modalHint:
      "The scraped name will fill the ingredient name field. You still set the quantity yourself.",
    clearResults: "Clear Results",
    closeBtn: "Close",
    searchingFor: "Searching Şok and Carrefour for",
    noResultsFound: "No results found",
    select: "Select",

    // Delete confirmation
    deleteConfirm: "Delete",

    // Add dessert prompt
    enterDessertName: "Enter dessert name:",

    // Language
    language: "Language",
    english: "English",
    arabic: "العربية",
  },
  ar: {
    // Login
    loginTitle: "تسجيل الدخول",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    loginBtn: "دخول / تسجيل",
    loginError: "استخدم البريد 5000 وكلمة المرور 5000",

    // Header
    appTitle: "مدير مقهى الحلويات",

    // Navigation
    timerTab: "المؤقت",
    marketTab: "أسعار السوق",
    settingsTab: "الإعدادات",

    // Timer Tab
    activeDesserts: "الحلويات النشطة",
    expiredDesserts: "الحلويات المنتهية",
    startBtn: "بدء",
    resetBtn: "إعادة",
    timeFinished: "انتهى وقت",

    // Market Tab
    marketPrices: "أسعار السوق",
    dessert: "الحلوى",
    findCheapestBtn: "البحث عن أرخص سوق",
    marketHint: "يستخدم كميات المكونات من الإعدادات.",
    ingredient: "المكون",
    qty: "الكمية",
    unit: "الوحدة",
    cost: "التكلفة",
    best: "الأفضل",
    totalSok: "إجمالي شوك",
    totalCarrefour: "إجمالي كارفور",
    cheapestMarket: "أرخص سوق",
    searching: "جاري البحث في شوك وكارفور، يرجى الانتظار…",
    selectDessert: "يرجى اختيار حلوى.",
    addIngredientsFirst: "يرجى إضافة المكونات في الإعدادات أولاً.",
    marketServiceError: "خطأ في خدمة السوق",

    // Settings Tab
    timerSettings: "إعدادات المؤقت",
    days: "أيام",
    hours: "ساعات",
    minutes: "دقائق",
    saveBtn: "حفظ",
    deleteBtn: "🗑 حذف",
    addNewDessertBtn: "+ إضافة حلوى جديدة",
    ingredientsTitle: "المكونات والكمية",
    addIngredientBtn: "+ إضافة مكون",

    // Ingredient Form
    ingredientName: "المكون",
    description: "الوصف / العلامة التجارية",
    need: "الكمية المطلوبة",
    perPackage: "لكل عبوة:",
    packSize: "حجم العبوة",
    pickFromMarket: "🛒 اختيار من السوق",
    openSok: "فتح شوك",
    openCarrefour: "فتح كارفور",

    // Validation
    ingredientNameRequired: "اسم المكون مطلوب.",
    quantityMustBeGreater: "يجب أن تكون الكمية المطلوبة أكبر من 0.",
    packageSizeMustBeGreater: "يجب أن يكون حجم العبوة أكبر من 0.",
    ingredientSaved: "تم حفظ المكون.",
    noIngredientsYet: "لا توجد مكونات بعد.",
    writeIngredientFirst: "اكتب اسم المكون أولاً.",

    // Pick Modal
    pickItemFromMarket: "🛒 اختيار عنصر من السوق",
    typeProductName: "اكتب اسم المنتج واضغط Enter…",
    searchBtn: "بحث",
    modalHint: "سيتم ملء اسم المكون من النتائج. عليك تحديد الكمية بنفسك.",
    clearResults: "مسح النتائج",
    closeBtn: "إغلاق",
    searchingFor: "البحث في شوك وكارفور عن",
    noResultsFound: "لم يتم العثور على نتائج",
    select: "اختيار",

    // Delete confirmation
    deleteConfirm: "حذف",

    // Add dessert prompt
    enterDessertName: "أدخل اسم الحلوى:",

    // Language
    language: "اللغة",
    english: "English",
    arabic: "العربية",
  },
};

function t(key) {
  return translations[currentLang][key] || translations["en"][key] || key;
}

function translateUI() {
  // Translate static elements
  const elements = {
    appTitle: "appTitle",
    activeDessertsTitle: "activeDessertsTitle",
    expiredDessertsTitle: "expiredDessertsTitle",
    marketPricesTitle: "marketPricesTitle",
    timerSettingsTitle: "timerSettingsTitle",
    ingredientsTitle: "ingredientsTitle",
    dessertLabel: "dessertLabel",
    marketHint: "marketHint",
    pickModalTitle: "pickModalTitle",
    pickSearchBtn: "pickSearchBtn",
    pickModalHint: "pickModalHint",
    clearResultsBtn: "clearResultsBtn",
    closeModalBtn: "closeModalBtn",
    findPricesBtn: "findPricesBtn",
  };

  for (const [key, id] of Object.entries(elements)) {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  }

  // Navigation buttons
  const navTimer = document.getElementById("navTimer");
  const navMarket = document.getElementById("navMarket");
  const navSettings = document.getElementById("navSettings");
  if (navTimer) navTimer.textContent = t("timerTab");
  if (navMarket) navMarket.textContent = t("marketTab");
  if (navSettings) navSettings.textContent = t("settingsTab");

  // Login elements
  const loginTitle = document.querySelector("#login h2");
  const loginBtn = document.querySelector("#login button");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  if (loginTitle) loginTitle.textContent = t("loginTitle");
  if (loginBtn) loginBtn.textContent = t("loginBtn");
  if (emailInput) emailInput.placeholder = t("email");
  if (passwordInput) passwordInput.placeholder = t("password");

  // Pick modal input placeholder
  const pickSearchInput = document.getElementById("pickSearchInput");
  if (pickSearchInput) pickSearchInput.placeholder = t("typeProductName");

  renderLanguageSwitcher();
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("app_lang", lang);
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lang;
  translateUI();
  render();
  renderSettings();
  renderDessertSelect();
}

function renderLanguageSwitcher() {
  const container = document.getElementById("langSwitcher");
  if (!container) return;
  container.innerHTML = `
    <select onchange="setLanguage(this.value)" class="lang-select">
      <option value="en" ${currentLang === "en" ? "selected" : ""}>${t("english")}</option>
      <option value="ar" ${currentLang === "ar" ? "selected" : ""}>${t("arabic")}</option>
    </select>
  `;
}

window.setLanguage = setLanguage;

// ─── Data ────────────────────────────────────────────────────────────────────

let desserts = [
  {
    name: "Magnolia",
    days: 5,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    ingredients: [],
  },
  {
    name: "English Cake",
    days: 5,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    ingredients: [],
  },
  {
    name: "Cheese Cake",
    days: 5,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    ingredients: [],
  },
  {
    name: "Tirimasu",
    days: 5,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    ingredients: [],
  },
  {
    name: "Othmaliye",
    days: 10,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    ingredients: [],
  },
  {
    name: "Fondant",
    days: 5,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    ingredients: [],
  },
  {
    name: "Sweet Syrup",
    days: 30,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    ingredients: [],
  },
  {
    name: "Ashta",
    days: 10,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    ingredients: [],
  },
  {
    name: "Cookies",
    days: 5,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    ingredients: [],
  },
];

// ─── Port Detection & API Configuration ─────────────────────────────────────

let retryCount = 0;
let serverFound = false;

async function detectServerPort() {
  const hostname = window.location.hostname;
  const loadingText = document.getElementById("loadingText");
  const loadingStatus = document.getElementById("loadingStatus");
  const retryCounter = document.getElementById("retryCounter");

  // Check if running from file:// (double-clicked HTML file)
  if (window.location.protocol === "file:") {
    if (loadingStatus) {
      loadingStatus.className = "loading-status waiting";
      loadingStatus.innerHTML =
        'Please open <a href="http://localhost:5050" style="color:#c89b6d;font-weight:bold">http://localhost:5050</a> in browser after starting server';
    }
    if (loadingText)
      loadingText.textContent = "Running from file - Start server first!";
    if (retryCounter)
      retryCounter.textContent = "Run start.bat to launch the server";
    return false;
  }

  // Update status
  if (loadingStatus) {
    loadingStatus.className = "loading-status connecting";
    loadingStatus.textContent = "Checking connection...";
  }

  // Production check
  const isNetlify =
    hostname.includes("netlify.app") ||
    hostname.includes("netlify.com") ||
    (window.location.protocol === "https:" &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1");

  if (isNetlify || hostname.includes("onrender")) {
    SCRAPER_API_BASE = `${window.location.origin}`;
    console.log(`Using cloud API: ${SCRAPER_API_BASE}`);
    serverFound = true;
    return true;
  }

  // Network IP access (from phone or other devices on same network)
  const isNetworkIP =
    hostname !== "localhost" &&
    hostname !== "127.0.0.1" &&
    !hostname.includes("netlify");
  if (isNetworkIP) {
    // Try current origin first (same host, same port)
    try {
      const res = await fetch(`${window.location.origin}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        SCRAPER_API_BASE = window.location.origin;
        serverFound = true;
        return true;
      }
    } catch (_) {}

    // Try all ports on the same host
    for (const port of PORTS_TO_TRY) {
      try {
        const res = await fetch(`http://${hostname}:${port}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          SCRAPER_API_BASE = `http://${hostname}:${port}`;
          serverFound = true;
          return true;
        }
      } catch (_) {}
    }
  }

  // Localhost - try to find server
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    // Check current origin first
    try {
      const res = await fetch(`${window.location.origin}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        SCRAPER_API_BASE = window.location.origin;
        console.log(`Using current server: ${SCRAPER_API_BASE}`);
        serverFound = true;
        if (loadingStatus) {
          loadingStatus.className = "loading-status connected";
          loadingStatus.textContent = "Connected!";
        }
        return true;
      }
    } catch (_) {}

    // Try other ports
    for (const port of PORTS_TO_TRY) {
      try {
        const res = await fetch(`http://localhost:${port}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          SCRAPER_API_BASE = `http://localhost:${port}`;
          console.log(`Connected to server on port ${port}`);
          serverFound = true;
          if (loadingStatus) {
            loadingStatus.className = "loading-status connected";
            loadingStatus.textContent = `Connected on port ${port}!`;
          }
          return true;
        }
      } catch (_) {}
    }
  }

  // Server not found - show waiting state
  retryCount++;
  if (loadingStatus) {
    loadingStatus.className = "loading-status waiting";
    loadingStatus.innerHTML =
      "❌ Server not running - Run <b>start.bat</b> to start the server";
  }
  if (loadingText) loadingText.textContent = "Server not found";

  return false;
}

// ─── Persistence ────────────────────────────────────────────────────────────

function loadLocal() {
  const raw = localStorage.getItem(LOCAL_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      desserts = parsed.map((d) => ({
        ...d,
        ingredients: (Array.isArray(d.ingredients) ? d.ingredients : []).map(
          normalizeIngredient,
        ),
      }));
    }
  } catch (_) {}
}

function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(desserts));
}

// ─── Boot ────────────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", async () => {
  // Load language preference
  currentLang = localStorage.getItem("app_lang") || "en";
  document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = currentLang;

  // Show connecting status
  const loadingText = document.getElementById("loadingText");
  const loadingStatus = document.getElementById("loadingStatus");
  if (loadingText) {
    loadingText.textContent =
      currentLang === "ar"
        ? "جاري الاتصال بالخادم..."
        : "Connecting to server...";
  }

  // Auto-detect server (will keep retrying if not found)
  const connected = await detectServerPort();

  // Only proceed if server was found
  if (!connected || !serverFound) {
    return; // Will keep retrying in detectServerPort
  }

  loadLocal();
  renderLanguageSwitcher();
  translateUI();

  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const loginBtn = document.querySelector("#login button");
  if (emailEl) emailEl.value = AUTO_EMAIL;
  if (passwordEl) passwordEl.value = AUTO_PASSWORD;
  if (loginBtn) {
    loginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.login();
    });
  }
  if (emailEl)
    emailEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") window.login();
    });
  if (passwordEl)
    passwordEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") window.login();
    });

  // Hide loading screen
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) loadingScreen.classList.add("hidden");
});

function normalizeIngredient(ing) {
  return {
    name: String(ing?.name || ""),
    quantity: Number.isFinite(Number(ing?.quantity)) ? Number(ing.quantity) : 1,
    unit: String(ing?.unit || "piece"),
    description: String(ing?.description || ""),
    packageSize: Number.isFinite(Number(ing?.packageSize))
      ? Number(ing.packageSize)
      : 1,
    packageUnit: String(ing?.packageUnit || "piece"),
  };
}

// ─── Auth ────────────────────────────────────────────────────────────────────

window.login = function () {
  const email = (document.getElementById("email").value || "").trim();
  const password = document.getElementById("password").value || "";
  if (email !== AUTO_EMAIL || password !== AUTO_PASSWORD) {
    alert(t("loginError"));
    return;
  }
  showApp();
};

function showApp() {
  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "block";
  render();
  renderSettings();
  renderDessertSelect();
  switchTab("timer");

  // Auto-initialize notifications (requests permission once, then remembers)
  initNotifications();
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

window.switchTab = function (tabName) {
  ["timer", "market", "settings"].forEach((tab) => {
    const el = document.getElementById(`tab-${tab}`);
    if (el) el.classList.toggle("hidden", tab !== tabName);
  });
};

// ─── Timer ───────────────────────────────────────────────────────────────────

function render() {
  const list = document.getElementById("list");
  const expired = document.getElementById("expired");
  list.innerHTML = "";
  expired.innerHTML = "";

  const now = Date.now();
  desserts.forEach((d, i) => {
    let remaining = 0;
    if (d.startTime) {
      remaining =
        d.days * 86400000 +
        d.hours * 3600000 +
        d.minutes * 60000 -
        (now - d.startTime);
    }

    if (d.startTime && remaining <= 0 && !d.finished) {
      d.finished = true;

      // Play alarm sound
      const alarm = document.getElementById("alarm");
      if (alarm) {
        alarm.play().catch(() => {}); // Ignore autoplay errors
      }

      // Send Chrome notification (appears like a broadcast)
      showChromeNotification(
        `🍰 ${t("timeFinished")} ${d.name}`,
        `Your ${d.name} dessert timer has finished!`,
      );

      saveLocal();
    }

    const div = document.createElement("div");
    div.className = "row";
    div.innerHTML = `
      <span>${d.name}</span>
      <button onclick="start(${i})">${t("startBtn")}</button>
      <button onclick="reset(${i})">${t("resetBtn")}</button>
      <span>${d.startTime ? formatTime(Math.max(0, remaining)) : ""}</span>
    `;
    if (d.finished || (d.startTime && remaining <= 0)) expired.appendChild(div);
    else list.appendChild(div);
  });
}

window.start = function (i) {
  desserts[i].startTime = Date.now();
  desserts[i].finished = false;
  render();
  saveLocal();
};

window.reset = function (i) {
  desserts[i].startTime = null;
  desserts[i].finished = false;
  render();
  saveLocal();
};

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

setInterval(render, 1000);

// ─── Settings ────────────────────────────────────────────────────────────────

function renderSettings() {
  const panel = document.getElementById("settings");
  panel.innerHTML = "";

  desserts.forEach((d, i) => {
    const row = document.createElement("div");
    row.className = "settings-row";
    row.innerHTML = `
      <span class="settings-name">${d.name}</span>
      <input type="number" value="${d.days}" min="0" id="days_${i}"> ${t("days")}
      <input type="number" value="${d.hours}" min="0" max="23" id="hours_${i}"> ${t("hours")}
      <input type="number" value="${d.minutes}" min="0" max="59" id="min_${i}"> ${t("minutes")}
      <button onclick="saveAdmin(${i})">${t("saveBtn")}</button>
      <button class="btn-delete" onclick="deleteDessert(${i})">${t("deleteBtn")}</button>
    `;
    panel.appendChild(row);
  });

  const addBtn = document.createElement("button");
  addBtn.textContent = t("addNewDessertBtn");
  addBtn.className = "btn-add-dessert";
  addBtn.onclick = addNewDessert;
  panel.appendChild(addBtn);

  renderIngredientsSettings();
}

window.saveAdmin = function (i) {
  const d = parseInt(document.getElementById(`days_${i}`).value, 10) || 0;
  const h = parseInt(document.getElementById(`hours_${i}`).value, 10) || 0;
  const m = parseInt(document.getElementById(`min_${i}`).value, 10) || 0;
  desserts[i].days = Math.max(0, d);
  desserts[i].hours = Math.max(0, Math.min(23, h));
  desserts[i].minutes = Math.max(0, Math.min(59, m));
  saveLocal();
  render();
};

window.deleteDessert = function (index) {
  if (!confirm(`${t("deleteConfirm")} "${desserts[index].name}"?`)) return;
  desserts.splice(index, 1);
  saveLocal();
  render();
  renderSettings();
  renderDessertSelect();
};

window.addNewDessert = function () {
  const name = prompt(t("enterDessertName"));
  if (!name || !name.trim()) return;
  desserts.push({
    name: name.trim(),
    days: 5,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    ingredients: [],
  });
  saveLocal();
  render();
  renderSettings();
  renderDessertSelect();
};

// ─── Pick from Market Modal ──────────────────────────────────────────────────

let _pickTarget = null;

window.openPickModal = async function (dessertIndex, ingredientIndex) {
  _pickTarget = { dessertIndex, ingredientIndex };
  const nameEl = document.getElementById(
    `ing_name_${dessertIndex}_${ingredientIndex}`,
  );
  const existing = (nameEl?.value || "").trim();

  const modal = document.getElementById("pickModal");
  const searchInput = document.getElementById("pickSearchInput");
  const resultsBox = document.getElementById("pickResults");
  searchInput.value = existing;
  resultsBox.innerHTML = "";
  modal.classList.remove("hidden");

  if (existing) await runPickSearch(existing);
};

window.closePickModal = function () {
  document.getElementById("pickModal").classList.add("hidden");
  _pickTarget = null;
};

window.clearPickResults = function () {
  document.getElementById("pickResults").innerHTML = "";
};

window.pickSearchKeydown = function (e) {
  if (e.key === "Enter")
    runPickSearch(document.getElementById("pickSearchInput").value.trim());
};

window.runPickSearch = async function (query) {
  if (!query) return;
  if (!SCRAPER_API_BASE) await detectServerPort();
  const resultsBox = document.getElementById("pickResults");
  resultsBox.innerHTML = `<p class="pick-loading">🔍 ${t("searchingFor")} "<strong>${query}</strong>"…</p>`;

  const url = `${SCRAPER_API_BASE}/search-all`;
  console.log(`Fetching: ${url}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product: query }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`API error ${res.status}:`, errorText);
      throw new Error(`API error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    console.log(`Search results:`, data);
    renderPickResults(data);
  } catch (err) {
    console.error("Search error:", err);
    resultsBox.innerHTML = `<p class="pick-error">Error: ${err.message}<br><small>API URL: ${url}</small></p>`;
  }
};

function renderPickResults(data) {
  const resultsBox = document.getElementById("pickResults");
  const markets = [
    { key: "sok", label: "Şok", color: "#e67e22" },
    { key: "carrefour", label: "Carrefour", color: "#2980b9" },
  ];

  let html = '<div class="pick-markets-container">';

  markets.forEach(({ key, label, color }) => {
    const items = data[key];
    html += `
      <div class="pick-market-section">
        <div class="pick-market-header" style="background: ${color}">
          <span>${label}</span>
        </div>
        <div class="pick-market-items">
    `;

    if (!items || !items.length) {
      html += `<div class="pick-no-result">${t("noResultsFound")}</div>`;
    } else {
      items.forEach((item, idx) => {
        const imgHtml = item.image
          ? `<img src="${item.image}" alt="" onerror="this.parentElement.innerHTML='<span>📦</span>'">`
          : "<span>📦</span>";
        const escapedName = escapeAttr(item.name);
        const displayName = escapeText(item.name);
        html += `
          <div class="pick-product-card">
            <div class="pick-product-img">
              ${imgHtml}
            </div>
            <div class="pick-product-info">
              <div class="pick-product-name">${displayName}</div>
              <div class="pick-product-price">${formatTryPrice(item.price)}</div>
            </div>
            <button class="pick-select-btn" data-name="${escapedName}">${t("select")}</button>
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
    `;
  });

  html += "</div>";
  resultsBox.innerHTML = html;

  resultsBox.querySelectorAll(".pick-select-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyPickedItem(btn.dataset.name);
    });
  });
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

window.applyPickedItem = function (name) {
  if (!_pickTarget) return;
  const { dessertIndex, ingredientIndex } = _pickTarget;
  const nameEl = document.getElementById(
    `ing_name_${dessertIndex}_${ingredientIndex}`,
  );
  if (nameEl) nameEl.value = name;
  closePickModal();
};

// ─── Ingredients Settings ────────────────────────────────────────────────────

function renderIngredientsSettings() {
  const panel = document.getElementById("ingredientsSettings");
  panel.innerHTML = "";

  desserts.forEach((dessert, dessertIndex) => {
    const wrapper = document.createElement("div");
    wrapper.className = "panel";
    wrapper.innerHTML = `
      <div class="ing-header">
        <h3>${dessert.name}</h3>
        <div class="ing-header-btns">
          <button onclick="addIngredient(${dessertIndex})">${t("addIngredientBtn")}</button>
        </div>
      </div>
      <div id="ingredients_${dessertIndex}" class="ingredients-list"></div>
    `;
    panel.appendChild(wrapper);

    const list = wrapper.querySelector(`#ingredients_${dessertIndex}`);
    const ingredients = Array.isArray(dessert.ingredients)
      ? dessert.ingredients
      : [];
    if (!ingredients.length) {
      const empty = document.createElement("div");
      empty.className = "no-ingredients";
      empty.textContent = t("noIngredientsYet");
      list.appendChild(empty);
      return;
    }
    ingredients.forEach((ing, ingredientIndex) => {
      const row = document.createElement("div");
      row.className = "ingredient-row";
      const safe = normalizeIngredient(ing);
      row.innerHTML = `
        <input type="text" id="ing_name_${dessertIndex}_${ingredientIndex}" placeholder="${t("ingredientName")}" value="${safe.name}">
        <input type="text" id="ing_desc_${dessertIndex}_${ingredientIndex}" placeholder="${t("description")}" value="${safe.description}">
        <input type="number" step="0.01" min="0.01" id="ing_qty_${dessertIndex}_${ingredientIndex}" placeholder="${t("need")}" value="${safe.quantity}">
        <select id="ing_unit_${dessertIndex}_${ingredientIndex}">
          ${renderUnitOptions(safe.unit)}
        </select>
        <span>${t("perPackage")}</span>
        <input type="number" step="0.01" min="0.01" id="ing_pack_${dessertIndex}_${ingredientIndex}" placeholder="${t("packSize")}" value="${safe.packageSize}">
        <select id="ing_pack_unit_${dessertIndex}_${ingredientIndex}">
          ${renderUnitOptions(safe.packageUnit)}
        </select>
        <button class="btn-pick" onclick="openPickModal(${dessertIndex}, ${ingredientIndex})">${t("pickFromMarket")}</button>
        <button onclick="saveIngredient(${dessertIndex}, ${ingredientIndex})">${t("saveBtn")}</button>
        <button onclick="openMarketLink('sok', ${dessertIndex}, ${ingredientIndex})">${t("openSok")}</button>
        <button onclick="openMarketLink('carrefour', ${dessertIndex}, ${ingredientIndex})">${t("openCarrefour")}</button>
        <button class="btn-delete" onclick="removeIngredient(${dessertIndex}, ${ingredientIndex})">${t("deleteBtn")}</button>
      `;
      list.appendChild(row);
    });
  });
}

window.addIngredient = function (dessertIndex) {
  if (!Array.isArray(desserts[dessertIndex].ingredients))
    desserts[dessertIndex].ingredients = [];
  desserts[dessertIndex].ingredients.push({
    name: "",
    quantity: 1,
    unit: "piece",
    description: "",
    packageSize: 1,
    packageUnit: "piece",
  });
  saveLocal();
  renderSettings();
};

window.saveIngredient = function (dessertIndex, ingredientIndex) {
  const nameEl = document.getElementById(
    `ing_name_${dessertIndex}_${ingredientIndex}`,
  );
  const descEl = document.getElementById(
    `ing_desc_${dessertIndex}_${ingredientIndex}`,
  );
  const qtyEl = document.getElementById(
    `ing_qty_${dessertIndex}_${ingredientIndex}`,
  );
  const unitEl = document.getElementById(
    `ing_unit_${dessertIndex}_${ingredientIndex}`,
  );
  const packEl = document.getElementById(
    `ing_pack_${dessertIndex}_${ingredientIndex}`,
  );
  const packUnitEl = document.getElementById(
    `ing_pack_unit_${dessertIndex}_${ingredientIndex}`,
  );

  if (!nameEl || !qtyEl || !unitEl || !packEl || !packUnitEl) {
    alert("Ingredient inputs not found. Please reopen Settings tab.");
    return;
  }

  const name = (nameEl.value || "").trim();
  const description = (descEl?.value || "").trim();
  const quantity = parseFloat(qtyEl.value || "0");
  const unit = unitEl.value || "piece";
  const packageSize = parseFloat(packEl.value || "0");
  const packageUnit = packUnitEl.value || "piece";

  if (!name) return alert(t("ingredientNameRequired"));
  if (!Number.isFinite(quantity) || quantity <= 0)
    return alert(t("quantityMustBeGreater"));
  if (!Number.isFinite(packageSize) || packageSize <= 0)
    return alert(t("packageSizeMustBeGreater"));

  desserts[dessertIndex].ingredients[ingredientIndex] = {
    name,
    description,
    quantity,
    unit,
    packageSize,
    packageUnit,
  };
  saveLocal();
  alert(t("ingredientSaved"));
  renderSettings();
  renderDessertSelect();
};

window.removeIngredient = function (dessertIndex, ingredientIndex) {
  desserts[dessertIndex].ingredients.splice(ingredientIndex, 1);
  saveLocal();
  renderSettings();
  renderDessertSelect();
};

// ─── Market Tab ──────────────────────────────────────────────────────────────

function renderDessertSelect() {
  const select = document.getElementById("dessertSelect");
  if (!select) return;
  select.innerHTML = "";
  desserts.forEach((dessert, i) => {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = dessert.name;
    select.appendChild(option);
  });
}

window.findCheapestForSelectedDessert = async function () {
  if (!SCRAPER_API_BASE) await detectServerPort();
  const select = document.getElementById("dessertSelect");
  const resultBox = document.getElementById("marketResult");
  const selectedIndex = Number(select?.value ?? -1);
  const dessert = desserts[selectedIndex];
  if (!dessert) return (resultBox.innerHTML = `<p>${t("selectDessert")}</p>`);

  const ingredients = (dessert.ingredients || [])
    .map((raw) => {
      const ing = normalizeIngredient(raw);
      const effectiveQuantity = calculateEffectiveQuantity(
        ing.quantity,
        ing.unit,
        ing.packageSize,
        ing.packageUnit,
      );
      return {
        name: [ing.name, ing.description].filter(Boolean).join(" "),
        quantity: effectiveQuantity,
        displayQuantity: `${ing.quantity} ${ing.unit} (pack ${ing.packageSize} ${ing.packageUnit})`,
      };
    })
    .filter((ing) => ing.name && ing.quantity > 0);

  if (!ingredients.length) {
    resultBox.innerHTML = `<p>${t("addIngredientsFirst")}</p>`;
    return;
  }

  const url = `${SCRAPER_API_BASE}/compare`;
  console.log(`Comparing prices at: ${url}`, ingredients);
  resultBox.innerHTML = `<p>${t("searching")}</p>`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredients }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error ${response.status}:`, errorText);
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`Compare results:`, data);
    renderMarketResult(data);
  } catch (err) {
    console.error("Compare error:", err);
    resultBox.innerHTML = `<p>${t("marketServiceError")}: ${err.message}<br><small>API URL: ${url}</small></p>`;
  }
};

function renderMarketResult(data) {
  const resultBox = document.getElementById("marketResult");
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const totals = data.totals || {};
  const cheapestMarket = data.cheapestMarket || "N/A";
  const cheapestTotal = Number(data.cheapestTotal || 0);

  let html = `<table class="market-table"><thead><tr>
    <th>${t("ingredient")}</th><th>${t("qty")}</th>
    <th>Şok ${t("unit")}</th><th>Şok ${t("cost")}</th>
    <th>Carrefour ${t("unit")}</th><th>Carrefour ${t("cost")}</th>
  </tr></thead><tbody>`;

  rows.forEach((row) => {
    html += `<tr>
      <td>${row.ingredient}</td>
      <td>${row.quantity}</td>
      <td>${formatTryPrice(row.sok?.unitPrice)}</td>
      <td>${formatTryPrice(row.sok?.cost)}</td>
      <td>${formatTryPrice(row.carrefour?.unitPrice)}</td>
      <td>${formatTryPrice(row.carrefour?.cost)}</td>
    </tr>`;
  });

  html += `</tbody></table>
    <p><strong>${t("totalSok")}:</strong> ${formatTryPrice(totals.sok)}</p>
    <p><strong>${t("totalCarrefour")}:</strong> ${formatTryPrice(totals.carrefour)}</p>
    <p class="best-market">${t("cheapestMarket")}: ${cheapestMarket} (${formatTryPrice(cheapestTotal)})</p>`;
  resultBox.innerHTML = html;
}

// ─── Open Market Links ───────────────────────────────────────────────────────

window.openMarketLink = function (market, dessertIndex, ingredientIndex) {
  const nameEl = document.getElementById(
    `ing_name_${dessertIndex}_${ingredientIndex}`,
  );
  const descEl = document.getElementById(
    `ing_desc_${dessertIndex}_${ingredientIndex}`,
  );
  const name = (nameEl?.value || "").trim();
  const desc = (descEl?.value || "").trim();
  const query = [name, desc].filter(Boolean).join(" ").trim();

  if (!query) {
    alert(t("writeIngredientFirst"));
    return;
  }

  const q = encodeURIComponent(query);
  const urls = {
    sok: `https://www.sokmarket.com.tr/arama?q=${q}`,
    carrefour: `https://www.carrefoursa.com/search/?q=${q}`,
  };
  if (urls[market]) window.open(urls[market], "_blank");
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderUnitOptions(selected) {
  return ["g", "kg", "ml", "l", "piece"]
    .map(
      (u) =>
        `<option value="${u}" ${u === selected ? "selected" : ""}>${u}</option>`,
    )
    .join("");
}

function toBaseUnit(value, unit) {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return null;
  const u = String(unit || "").toLowerCase();
  if (u === "g") return { type: "mass", value: v };
  if (u === "kg") return { type: "mass", value: v * 1000 };
  if (u === "ml") return { type: "volume", value: v };
  if (u === "l") return { type: "volume", value: v * 1000 };
  if (u === "piece") return { type: "count", value: v };
  return null;
}

function calculateEffectiveQuantity(needQty, needUnit, packQty, packUnit) {
  const need = toBaseUnit(needQty, needUnit);
  const pack = toBaseUnit(packQty, packUnit);
  if (!need || !pack) return Number(needQty) || 1;
  if (need.type !== pack.type) return Number(needQty) || 1;
  return Math.max(need.value / pack.value, 0.01);
}

function formatTryPrice(value) {
  if (!Number.isFinite(Number(value))) return "-";
  return `${Number(value).toFixed(2)} TL`;
}

// ─── Chrome Notifications ───────────────────────────────────────────────────

let notificationsEnabled = false;

// Initialize notifications - auto-request permission on first use
async function initNotifications() {
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications");
    return false;
  }

  // Already granted - enable automatically
  if (Notification.permission === "granted") {
    notificationsEnabled = true;
    updateNotifButton();
    return true;
  }

  // Not denied yet - auto-request permission
  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      notificationsEnabled = true;
      updateNotifButton();

      // Show welcome notification
      setTimeout(() => {
        showChromeNotification(
          "🍰 Notifications Enabled!",
          "You will receive alerts when dessert timers finish.",
        );
      }, 1000);

      return true;
    }
  }

  return false;
}

// Toggle notifications
window.toggleNotifications = async function () {
  const btn = document.getElementById("notifBtn");

  if (!("Notification" in window)) {
    alert("This browser does not support notifications");
    return;
  }

  if (Notification.permission === "denied") {
    alert(
      'Notifications are blocked.\n\nTo enable:\n1. Click the 🔒 icon in the address bar\n2. Set Notifications to "Allow"\n3. Refresh the page',
    );
    return;
  }

  if (notificationsEnabled) {
    notificationsEnabled = false;
    btn.classList.remove("active");
    btn.title = "Notifications OFF - Click to enable";
    return;
  }

  // Request permission
  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    notificationsEnabled = true;
    btn.classList.add("active");
    btn.title = "Notifications ON - Click to disable";

    // Show confirmation notification
    showChromeNotification(
      "🍰 Notifications Enabled!",
      "You will receive alerts when dessert timers finish.",
    );
  }
};

// Show Chrome notification (appears like any other app notification)
function showChromeNotification(title, body, tag = "dessert-timer") {
  // Only check if browser supports notifications and permission is granted
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const options = {
    body: body,
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍰</text></svg>",
    badge:
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍰</text></svg>",
    tag: tag,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    silent: false,
  };

  // Use Service Worker (works even when tab is in background)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, options);
    });
  } else {
    // Fallback to regular Notification
    new Notification(title, options);
  }
}

// Update notification button state
function updateNotifButton() {
  const btn = document.getElementById("notifBtn");
  if (!btn) return;

  if (notificationsEnabled && Notification.permission === "granted") {
    btn.classList.add("active");
    btn.title = "Notifications ON - Click to disable";
  } else {
    btn.classList.remove("active");
    btn.title = "Notifications OFF - Click to enable";
  }
}
