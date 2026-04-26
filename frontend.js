// ============================================================
// DESSERT CAFE MANAGER - FRONTEND JAVASCRIPT
// ============================================================

const PORTS_TO_TRY = [
  5050, 5051, 5052, 5053, 8080, 3000, 5000, 7000, 8000, 13000, 13001, 13002,
  15050, 15051, 18080,
];
let SCRAPER_API_BASE = null;
const AUTO_EMAIL = "5000";
const AUTO_PASSWORD = "5000";
const LOCAL_KEY = "desserts_offline_data_v2";
const REPORT_KEY = "desserts_monthly_reports_v1";
const TIMER_USAGE_KEY = "desserts_timer_usage_v1";
let pushToken = null;
let pushStatus = {
  checked: false,
  supported: false,
  publicKey: null,
  firebaseConfig: null,
  reason: null,
};

const FIREBASE_CONFIG_FALLBACK = {
  apiKey: "AIzaSyDQSPs6oly79c18Nyi-SP_WJlp52l9Ja7g",
  authDomain: "hookahtalya-b865f.firebaseapp.com",
  projectId: "hookahtalya-b865f",
  storageBucket: "hookahtalya-b865f.firebasestorage.app",
  messagingSenderId: "635656922703",
  appId: "1:635656922703:web:a27e2c407484ed641b2c3a",
};

let currentLang = localStorage.getItem("app_lang") || "en";
let monthlyReports = {};
let selectedReportMonth = null;
let timerUsage = {};

const translations = {
  en: {
    loginTitle: "Login",
    email: "Email",
    password: "Password",
    loginBtn: "Login / Register",
    loginError: "Use the correct email and password ",
    appTitle: "Dessert Cafe Manager",
    timerTab: "Timer",
    marketTab: "Market Prices",
    settingsTab: "Settings",
    activeDesserts: "Active Desserts",
    expiredDesserts: "Expired Desserts",
    startBtn: "Start",
    resetBtn: "Reset",
    timeFinished: "Time finished for",
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
    totalMigros: "Total Migros",
    cheapestMarket: "Cheapest Market",
    searching: "Searching Şok and Migros, please wait…",
    selectDessert: "Please select a dessert.",
    addIngredientsFirst: "Please add ingredients in Settings first.",
    marketServiceError: "Market service error",
    timerSettings: "Timer Settings",
    days: "days",
    hours: "hours",
    minutes: "minutes",
    saveBtn: "Save",
    deleteBtn: "🗑 Delete",
    addNewDessertBtn: "+ Add New Dessert",
    ingredientsTitle: "Ingredients and Quantity",
    addIngredientBtn: "+ Add Ingredient",
    ingredientName: "Ingredient",
    description: "Description / Brand",
    need: "Need",
    perPackage: "per package:",
    packSize: "Pack size",
    pickFromMarket: "🛒 Pick from Market",
    openSok: "Open Şok",
    openMigros: "Open Migros",
    ingredientNameRequired: "Ingredient name is required.",
    quantityMustBeGreater: "Needed quantity must be greater than 0.",
    packageSizeMustBeGreater: "Package size must be greater than 0.",
    ingredientSaved: "Ingredient saved.",
    noIngredientsYet: "No ingredients yet.",
    writeIngredientFirst: "Write ingredient name first.",
    pickItemFromMarket: "🛒 Pick Item from Market",
    typeProductName: "Type product name and press Enter…",
    searchBtn: "Search",
    modalHint: "The scraped name will fill the ingredient name field.",
    clearResults: "Clear Results",
    closeBtn: "Close",
    searchingFor: "Searching Şok and Migros for",
    noResultsFound: "No results found",
    select: "Select",
    pickChooseBoth:
      "Choose one item from Sok and one from Migros before saving.",
    pickSelectedFrom: "Selected from",
    pickSelectionReady: "Both market selections are ready.",
    pickSaveBoth: "Save Both Selections",
    pickNeedOtherMarket: "Choose one item from the other market too.",
    deleteConfirm: "Delete",
    enterDessertName: "Enter dessert name:",
    quantityToSearch: "Quantity",
    quantityUnit: "Unit",
    estimatedCost: "Estimated Cost",
    sokLabel: "Sok",
    migrosLabel: "Migros",
    chosenItem: "Chosen Item",
    selectedState: "Selected",
    none: "None",
    onePiece: "1 piece",
    fromLabel: "from",
    unavailable: "Unavailable",
    checkingConnection: "Checking connection...",
    loadingStartServer: "Open http://localhost:5050 after starting server",
    startServerFirst: "Start server first!",
    runStartBat: "Run start.bat",
    connected: "Connected!",
    portLabel: "Port",
    serverNotRunning: "Server not running - Run start.bat",
    serverNotFound: "Server not found",
    reopenSettings: "Reopen Settings tab.",
    errorPrefix: "Error",
    browserNoNotifications: "Browser does not support notifications",
    notificationsBlocked:
      "Notifications blocked. Click the lock icon in the address bar to allow them.",
    enableNotifications: "Enable Notifications",
    disableNotifications: "Disable Notifications",
    notificationsEnabledTitle: "Notifications Enabled!",
    notificationsEnabledBody:
      "You will receive alerts when dessert timers finish.",
    pushUnavailableNow: "Push notifications are not available right now.",
    pushNotConfigured: "Push notifications are not configured on this server",
    pushUnsupportedDevice:
      "Push notifications are not supported on this device",
    pushFailedToken: "Failed to get FCM token",
    language: "Language",
    english: "English",
    arabic: "العربية",
  },
  ar: {
    loginTitle: "تسجيل الدخول",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    loginBtn: "دخول / تسجيل",
    loginError: "استخدم البريد 5000 وكلمة المرور 5000",
    appTitle: "مدير مقهى الحلويات",
    timerTab: "المؤقت",
    marketTab: "أسعار السوق",
    settingsTab: "الإعدادات",
    activeDesserts: "الحلويات النشطة",
    expiredDesserts: "الحلويات المنتهية",
    startBtn: "بدء",
    resetBtn: "إعادة",
    timeFinished: "انتهى وقت",
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
    totalMigros: "إجمالي ميغروس",
    cheapestMarket: "أرخص سوق",
    searching: "جاري البحث في شوك وميغروس، يرجى الانتظار…",
    selectDessert: "يرجى اختيار حلوى.",
    addIngredientsFirst: "يرجى إضافة المكونات في الإعدادات أولاً.",
    marketServiceError: "خطأ في خدمة السوق",
    timerSettings: "إعدادات المؤقت",
    days: "أيام",
    hours: "ساعات",
    minutes: "دقائق",
    saveBtn: "حفظ",
    deleteBtn: "🗑 حذف",
    addNewDessertBtn: "+ إضافة حلوى جديدة",
    ingredientsTitle: "المكونات والكمية",
    addIngredientBtn: "+ إضافة مكون",
    ingredientName: "المكون",
    description: "الوصف / العلامة التجارية",
    need: "الكمية المطلوبة",
    perPackage: "لكل عبوة:",
    packSize: "حجم العبوة",
    pickFromMarket: "🛒 اختيار من السوق",
    openSok: "فتح شوك",
    openMigros: "فتح ميغروس",
    ingredientNameRequired: "اسم المكون مطلوب.",
    quantityMustBeGreater: "يجب أن تكون الكمية المطلوبة أكبر من 0.",
    packageSizeMustBeGreater: "يجب أن يكون حجم العبوة أكبر من 0.",
    ingredientSaved: "تم حفظ المكون.",
    noIngredientsYet: "لا توجد مكونات بعد.",
    writeIngredientFirst: "اكتب اسم المكون أولاً.",
    pickItemFromMarket: "🛒 اختيار عنصر من السوق",
    typeProductName: "اكتب اسم المنتج واضغط Enter…",
    searchBtn: "بحث",
    modalHint: "سيتم ملء اسم المكون من النتائج.",
    clearResults: "مسح النتائج",
    closeBtn: "إغلاق",
    searchingFor: "البحث في شوك وميغروس عن",
    noResultsFound: "لم يتم العثور على نتائج",
    select: "اختيار",
    deleteConfirm: "حذف",
    enterDessertName: "أدخل اسم الحلوى:",
    quantityToSearch: "الكمية",
    quantityUnit: "الوحدة",
    estimatedCost: "التكلفة التقديرية",
    language: "اللغة",
    english: "English",
    arabic: "العربية",
  },
};

const extraTranslations = {
  en: {
    sokLabel: "Sok",
    migrosLabel: "Migros",
    chosenItem: "Chosen Item",
    selectedState: "Selected",
    none: "None",
    onePiece: "1 piece",
    fromLabel: "from",
    unavailable: "Unavailable",
    checkingConnection: "Checking connection...",
    loadingStartServer: "Open http://localhost:5050 after starting server",
    startServerFirst: "Start server first!",
    runStartBat: "Run start.bat",
    connected: "Connected!",
    portLabel: "Port",
    serverNotRunning: "Server not running - Run start.bat",
    serverNotFound: "Server not found",
    reopenSettings: "Reopen Settings tab.",
    errorPrefix: "Error",
    browserNoNotifications: "Browser does not support notifications",
    notificationsBlocked:
      "Notifications blocked. Click the lock icon in the address bar to allow them.",
    enableNotifications: "Enable Notifications",
    disableNotifications: "Disable Notifications",
    notificationsEnabledTitle: "Notifications Enabled!",
    notificationsEnabledBody:
      "You will receive alerts when dessert timers finish.",
    pushUnavailableNow: "Push notifications are not available right now.",
    pushNotConfigured: "Push notifications are not configured on this server",
    pushUnsupportedDevice:
      "Push notifications are not supported on this device",
    pushFailedToken: "Failed to get FCM token",
    arabic: "Arabic",
    reportsTab: "Reports",
    reportsTitle: "Monthly Cost Report",
    reportMonth: "Month",
    reportRuns: "Compare Runs",
    reportDesserts: "Desserts Compared",
    reportTrackedIngredients: "Tracked Ingredients",
    reportMarketTotals: "Monthly Market Totals",
    reportDessertUsage: "Dessert Activity",
    reportIngredientTrends: "Ingredient Price Trend",
    reportIngredientName: "Ingredient",
    reportTimesUsed: "Times Used",
    reportFirstPrice: "First Price",
    reportLastPrice: "Last Price",
    reportChange: "Change",
    reportMoves: "Moves",
    reportNoData: "No data yet",
    reportMonthEmpty:
      "No monthly report yet. Run Find Cheapest Market to start tracking.",
    reportIncrease: "up",
    reportDecrease: "down",
    reportSame: "same",
    exportPDF: "Export PDF",
    allMonthsComparison: "All Months Comparison",
    reportSearchCount: "Search Count",
    totalCost: "Total",
    bestPrice: "Best Price",
    potentialSavings: "Potential Savings",
    timerUsageSummary: "Timer Usage Summary",
    reportTimerUsage: "Timer Uses",
    reportTimerCount: "Timer Count",
    eraseAll: "Erase All",
    eraseAllConfirm:
      "Are you sure you want to erase ALL data? This includes all reports, timer usage, and ingredients. This cannot be undone.",
    dataErased: "All data has been erased.",
  },
  ar: {
    sokLabel: "\u0634\u0648\u0643",
    migrosLabel: "\u0645\u064a\u063a\u0631\u0648\u0633",
    chosenItem:
      "\u0627\u0644\u0639\u0646\u0635\u0631 \u0627\u0644\u0645\u062e\u062a\u0627\u0631",
    selectedState: "\u0645\u062d\u062f\u062f",
    none: "\u0644\u0627 \u064a\u0648\u062c\u062f",
    onePiece: "\u0642\u0637\u0639\u0629 \u0648\u0627\u062d\u062f\u0629",
    fromLabel: "\u0645\u0646",
    unavailable: "\u063a\u064a\u0631 \u0645\u062a\u0627\u062d",
    checkingConnection:
      "\u062c\u0627\u0631\u064a \u0641\u062d\u0635 \u0627\u0644\u0627\u062a\u0635\u0627\u0644...",
    loadingStartServer:
      "\u0627\u0641\u062a\u062d http://localhost:5050 \u0628\u0639\u062f \u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0633\u064a\u0631\u0641\u0631",
    startServerFirst:
      "\u0634\u063a\u0644 \u0627\u0644\u0633\u064a\u0631\u0641\u0631 \u0623\u0648\u0644\u0627\u064b!",
    runStartBat: "Run start.bat",
    connected: "\u062a\u0645 \u0627\u0644\u0627\u062a\u0635\u0627\u0644!",
    portLabel: "\u0627\u0644\u0645\u0646\u0641\u0630",
    serverNotRunning:
      "\u0627\u0644\u0633\u064a\u0631\u0641\u0631 \u0644\u0627 \u064a\u0639\u0645\u0644 - Run start.bat",
    serverNotFound:
      "\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0633\u064a\u0631\u0641\u0631",
    reopenSettings:
      "\u0623\u0639\u062f \u0641\u062a\u062d \u062a\u0628\u0648\u064a\u0628 \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a.",
    errorPrefix: "\u062e\u0637\u0623",
    browserNoNotifications:
      "\u0627\u0644\u0645\u062a\u0635\u0641\u062d \u0644\u0627 \u064a\u062f\u0639\u0645 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a",
    notificationsBlocked:
      "\u062a\u0645 \u062d\u0638\u0631 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a. \u0627\u0636\u063a\u0637 \u0639\u0644\u0649 \u0631\u0645\u0632 \u0627\u0644\u0642\u0641\u0644 \u0641\u064a \u0634\u0631\u064a\u0637 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0644\u0644\u0633\u0645\u0627\u062d \u0628\u0647\u0627.",
    enableNotifications:
      "\u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a",
    disableNotifications:
      "\u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a",
    notificationsEnabledTitle:
      "\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a!",
    notificationsEnabledBody:
      "\u0633\u062a\u0635\u0644\u0643 \u062a\u0646\u0628\u064a\u0647\u0627\u062a \u0639\u0646\u062f \u0627\u0646\u062a\u0647\u0627\u0621 \u0645\u0624\u0642\u062a \u0627\u0644\u062d\u0644\u0648\u0649.",
    pushUnavailableNow:
      "\u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0627\u0644\u062f\u0641\u0639 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629 \u0627\u0644\u0622\u0646.",
    pushNotConfigured:
      "\u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0627\u0644\u062f\u0641\u0639 \u063a\u064a\u0631 \u0645\u0647\u064a\u0623\u0629 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0633\u064a\u0631\u0641\u0631",
    pushUnsupportedDevice:
      "\u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0627\u0644\u062f\u0641\u0639 \u063a\u064a\u0631 \u0645\u062f\u0639\u0648\u0645\u0629 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u062c\u0647\u0627\u0632",
    pushFailedToken:
      "\u0641\u0634\u0644 \u0641\u064a \u0627\u0644\u062d\u0635\u0648\u0644 \u0639\u0644\u0649 \u0631\u0645\u0632 FCM",
    arabic: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629",
    reportsTab: "\u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631",
    reportsTitle:
      "\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0634\u0647\u0631\u064a",
    reportMonth: "\u0627\u0644\u0634\u0647\u0631",
    reportRuns:
      "\u0645\u0631\u0627\u062a \u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629",
    reportDesserts:
      "\u0627\u0644\u062d\u0644\u0648\u064a\u0627\u062a \u0627\u0644\u062a\u064a \u062a\u0645\u062a \u0645\u0642\u0627\u0631\u0646\u062a\u0647\u0627",
    reportTrackedIngredients:
      "\u0627\u0644\u0645\u0643\u0648\u0646\u0627\u062a \u0627\u0644\u0645\u062a\u062a\u0628\u0639\u0629",
    reportMarketTotals:
      "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0623\u0633\u0648\u0627\u0642 \u0627\u0644\u0634\u0647\u0631\u064a",
    reportDessertUsage:
      "\u0646\u0634\u0627\u0637 \u0627\u0644\u062d\u0644\u0648\u064a\u0627\u062a",
    reportIngredientTrends:
      "\u0627\u062a\u062c\u0627\u0647 \u0633\u0639\u0631 \u0627\u0644\u0645\u0643\u0648\u0646\u0627\u062a",
    reportIngredientName: "\u0627\u0644\u0645\u0643\u0648\u0646",
    reportTimesUsed:
      "\u0645\u0631\u0627\u062a \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645",
    reportFirstPrice: "\u0623\u0648\u0644 \u0633\u0639\u0631",
    reportLastPrice: "\u0622\u062e\u0631 \u0633\u0639\u0631",
    reportChange: "\u0627\u0644\u062a\u063a\u064a\u0631",
    reportMoves: "\u0627\u0644\u062d\u0631\u0643\u0627\u062a",
    reportNoData:
      "\u0644\u0627 \u0628\u064a\u0627\u0646\u0627\u062a \u0628\u0639\u062f",
    reportMonthEmpty:
      "\u0644\u0627 \u064a\u0648\u062c\u062f \u062a\u0642\u0631\u064a\u0631 \u0634\u0647\u0631\u064a \u0628\u0639\u062f. \u0634\u063a\u0644 \u0627\u0644\u0628\u062d\u062b \u0639\u0646 \u0623\u0631\u062e\u0635 \u0633\u0648\u0642 \u0644\u0628\u062f\u0621 \u0627\u0644\u062a\u062a\u0628\u0639.",
    reportIncrease: "\u0627\u0631\u062a\u0641\u0627\u0639",
    reportDecrease: "\u0627\u0646\u062e\u0641\u0627\u0636",
    reportSame: "\u062b\u0627\u0628\u062a",
    exportPDF: "\u062a\u0635\u062f\u064a\u0631 PDF",
    allMonthsComparison:
      "\u0645\u0642\u0627\u0631\u0646\u0629 \u062c\u0645\u064a\u0639 \u0627\u0644\u0623\u0634\u0647\u0631",
    reportSearchCount: "\u0639\u062f\u062f \u0627\u0644\u0628\u062d\u062b",
    totalCost: "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a",
    bestPrice: "\u0623\u0641\u0636\u0644 \u0633\u0639\u0631",
    potentialSavings:
      "\u0627\u0644\u062a\u0648\u0641\u064a\u0631 \u0627\u0644\u0645\u062d\u062a\u0645\u0644",
    timerUsageSummary:
      "\u0645\u0644\u062e\u0635 \u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u0645\u0624\u0642\u062a",
    reportTimerUsage:
      "\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u0645\u0624\u0642\u062a",
    reportTimerCount: "\u0639\u062f\u062f \u0627\u0644\u0645\u0624\u0642\u062a",
    eraseAll: "\u0645\u0633\u062d \u0627\u0644\u0643\u0644",
    eraseAllConfirm:
      "\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0623\u0646\u0643 \u062a\u0631\u064a\u062f \u0645\u0633\u062d \u062c\u0645\u064a\u0639 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a\u061f \u0644\u0627 \u064a\u0645\u0643\u0646 \u0627\u0644\u062a\u0631\u0627\u062c\u0639 \u0639\u0646 \u0630\u0644\u0643.",
    dataErased:
      "\u062a\u0645 \u0645\u0633\u062d \u062c\u0645\u064a\u0639 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a.",
  },
};

function t(key) {
  return (
    extraTranslations[currentLang]?.[key] ||
    translations[currentLang]?.[key] ||
    extraTranslations.en[key] ||
    translations.en[key] ||
    key
  );
}

function marketLabel(market) {
  const value = String(market || "").toLowerCase();
  if (value === "sok") return t("sokLabel");
  if (value === "migros") return t("migrosLabel");
  if (value === "n/a") return t("unavailable");
  return market || t("unavailable");
}

function unitLabel(unit) {
  return unit === "piece" ? t("onePiece") : unit;
}

function isAndroidAppBridgeAvailable() {
  return (
    typeof window !== "undefined" &&
    window.AndroidApp &&
    typeof window.AndroidApp.isAndroidApp === "function" &&
    window.AndroidApp.isAndroidApp()
  );
}

function hasAndroidNotificationPermission() {
  return (
    isAndroidAppBridgeAvailable() &&
    typeof window.AndroidApp.isNotificationPermissionGranted === "function" &&
    window.AndroidApp.isNotificationPermissionGranted()
  );
}

function translateUI() {
  const map = {
    appTitle: "appTitle",
    activeDessertsTitle: "activeDesserts",
    expiredDessertsTitle: "expiredDesserts",
    marketPricesTitle: "marketPrices",
    timerSettingsTitle: "timerSettings",
    ingredientsTitle: "ingredientsTitle",
    reportsTitle: "reportsTitle",
    dessertLabel: "dessert",
    marketHint: "marketHint",
    pickModalTitle: "pickItemFromMarket",
    pickSearchBtn: "searchBtn",
    pickModalHint: "modalHint",
    clearResultsBtn: "clearResults",
    closeModalBtn: "closeBtn",
    findPricesBtn: "findCheapestBtn",
  };
  for (const [key, id] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  }
  const n = document.getElementById("navTimer");
  if (n) n.textContent = t("timerTab");
  const m = document.getElementById("navMarket");
  if (m) m.textContent = t("marketTab");
  const s = document.getElementById("navSettings");
  if (s) s.textContent = t("settingsTab");
  const r = document.getElementById("navReports");
  if (r) r.textContent = t("reportsTab");
  const lt = document.querySelector("#login h2");
  if (lt) lt.textContent = t("loginTitle");
  const lb = document.querySelector("#login button");
  if (lb) lb.textContent = t("loginBtn");
  const e = document.getElementById("email");
  if (e) e.placeholder = t("email");
  const p = document.getElementById("password");
  if (p) p.placeholder = t("password");
  const psi = document.getElementById("pickSearchInput");
  if (psi) psi.placeholder = t("typeProductName");
  const pqi = document.getElementById("pickQuantityInput");
  if (pqi) pqi.placeholder = t("quantityToSearch");
  const pqu = document.getElementById("pickQuantityUnit");
  if (pqu) pqu.title = t("quantityUnit");
  renderLanguageSwitcher();
  renderMonthlyReport();
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
  renderMonthlyReport();
}

function renderLanguageSwitcher() {
  const c = document.getElementById("langSwitcher");
  if (!c) return;
  c.innerHTML = `<select onchange="setLanguage(this.value)" class="lang-select">
    <option value="en" ${currentLang === "en" ? "selected" : ""}>${t("english")}</option>
    <option value="ar" ${currentLang === "ar" ? "selected" : ""}>${t("arabic")}</option></select>`;
}
window.setLanguage = setLanguage;

function loadReports() {
  const raw = localStorage.getItem(REPORT_KEY);
  if (!raw) {
    monthlyReports = {};
    selectedReportMonth = currentMonthKey();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    monthlyReports = parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    monthlyReports = {};
  }
  const months = getReportMonths();
  selectedReportMonth =
    selectedReportMonth && monthlyReports[selectedReportMonth]
      ? selectedReportMonth
      : months[0] || currentMonthKey();
}

function saveReports() {
  localStorage.setItem(REPORT_KEY, JSON.stringify(monthlyReports));
}

function loadTimerUsage() {
  const raw = localStorage.getItem(TIMER_USAGE_KEY);
  if (!raw) {
    timerUsage = {};
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    timerUsage = parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    timerUsage = {};
  }
}

function saveTimerUsage() {
  localStorage.setItem(TIMER_USAGE_KEY, JSON.stringify(timerUsage));
}

function recordTimerUsage(dessertName) {
  const monthKey = currentMonthKey();
  if (!timerUsage[monthKey]) timerUsage[monthKey] = {};
  if (!timerUsage[monthKey][dessertName]) timerUsage[monthKey][dessertName] = 0;
  timerUsage[monthKey][dessertName] += 1;
  saveTimerUsage();
}

function getTimerUsageForMonth(monthKey) {
  return timerUsage[monthKey] || {};
}

function currentMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getReportMonths() {
  return Object.keys(monthlyReports || {}).sort((a, b) => b.localeCompare(a));
}

function formatReportMonth(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey))
    return monthKey || t("reportNoData");
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(
    currentLang === "ar" ? "ar" : "en",
    {
      year: "numeric",
      month: "long",
    },
  );
}

function recordMonthlyReport(dessertName, reportData) {
  const monthKey = currentMonthKey();
  if (!Array.isArray(monthlyReports[monthKey])) monthlyReports[monthKey] = [];
  monthlyReports[monthKey].push({
    timestamp: new Date().toISOString(),
    dessertName: String(dessertName || ""),
    totals: {
      sok: Number(reportData?.totals?.sok ?? 0),
      migros: Number(reportData?.totals?.migros ?? 0),
    },
    cheapestMarket: String(reportData?.cheapestMarket || ""),
    rows: Array.isArray(reportData?.rows)
      ? reportData.rows.map((row) => ({
          ingredient: String(row?.ingredient || ""),
          quantity: String(row?.quantity || ""),
          sok: {
            name: String(row?.sok?.name || ""),
            unitPrice: Number.isFinite(Number(row?.sok?.unitPrice))
              ? Number(row.sok.unitPrice)
              : null,
            cost: Number.isFinite(Number(row?.sok?.cost))
              ? Number(row.sok.cost)
              : null,
          },
          migros: {
            name: String(row?.migros?.name || ""),
            unitPrice: Number.isFinite(Number(row?.migros?.unitPrice))
              ? Number(row.migros.unitPrice)
              : null,
            cost: Number.isFinite(Number(row?.migros?.cost))
              ? Number(row.migros.cost)
              : null,
          },
        }))
      : [],
  });
  if (monthlyReports[monthKey].length > 250)
    monthlyReports[monthKey] = monthlyReports[monthKey].slice(-250);
  selectedReportMonth = monthKey;
  saveReports();
}

function summarizeMonthlyReport(monthKey) {
  const entries = Array.isArray(monthlyReports?.[monthKey])
    ? monthlyReports[monthKey]
    : [];
  const dessertCounts = {};
  const ingredientMap = new Map();
  const totals = { sok: 0, migros: 0 };

  entries.forEach((entry) => {
    const dessertName = String(entry?.dessertName || "").trim();
    if (dessertName)
      dessertCounts[dessertName] = (dessertCounts[dessertName] || 0) + 1;
    if (Number.isFinite(Number(entry?.totals?.sok)))
      totals.sok += Number(entry.totals.sok);
    if (Number.isFinite(Number(entry?.totals?.migros)))
      totals.migros += Number(entry.totals.migros);

    (Array.isArray(entry?.rows) ? entry.rows : []).forEach((row) => {
      const ingredientName = String(row?.ingredient || "").trim();
      if (!ingredientName) return;
      if (!ingredientMap.has(ingredientName)) {
        ingredientMap.set(ingredientName, { count: 0, values: [] });
      }
      const stats = ingredientMap.get(ingredientName);
      stats.count += 1;
      const numericValues = [row?.sok?.cost, row?.migros?.cost]
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 0);
      if (numericValues.length) {
        stats.values.push({
          timestamp: String(entry?.timestamp || ""),
          value: Math.min(...numericValues),
        });
      }
    });
  });

  const ingredientRows = [...ingredientMap.entries()]
    .map(([ingredient, stats]) => {
      const orderedValues = stats.values
        .slice()
        .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
      const firstValue = orderedValues.length ? orderedValues[0].value : null;
      const lastValue = orderedValues.length
        ? orderedValues[orderedValues.length - 1].value
        : null;
      let increases = 0;
      let decreases = 0;
      let same = 0;
      for (let index = 1; index < orderedValues.length; index += 1) {
        const prev = orderedValues[index - 1].value;
        const next = orderedValues[index].value;
        if (next > prev) increases += 1;
        else if (next < prev) decreases += 1;
        else same += 1;
      }
      return {
        ingredient,
        count: stats.count,
        firstValue,
        lastValue,
        change:
          firstValue !== null && lastValue !== null
            ? lastValue - firstValue
            : null,
        increases,
        decreases,
        same,
      };
    })
    .sort(
      (a, b) => b.count - a.count || a.ingredient.localeCompare(b.ingredient),
    );

  const dessertRows = Object.entries(dessertCounts)
    .map(([dessert, count]) => ({ dessert, count }))
    .sort((a, b) => b.count - a.count || a.dessert.localeCompare(b.dessert));

  return {
    monthKey,
    entries,
    ingredientRows,
    dessertRows,
    totals,
    timerUsage: getTimerUsageForMonth(monthKey),
  };
}

function renderMonthlyReport() {
  const panel = document.getElementById("monthlyReport");
  if (!panel) return;
  const months = getReportMonths();
  const activeMonth =
    selectedReportMonth &&
    (monthlyReports[selectedReportMonth] ||
      selectedReportMonth === currentMonthKey())
      ? selectedReportMonth
      : months[0] || currentMonthKey();
  selectedReportMonth = activeMonth;
  const summary = summarizeMonthlyReport(activeMonth);
  const monthOptions = months.length
    ? months
        .map(
          (month) =>
            `<option value="${escapeAttr(month)}" ${month === activeMonth ? "selected" : ""}>${escapeText(formatReportMonth(month))}</option>`,
        )
        .join("")
    : `<option value="${escapeAttr(activeMonth)}">${escapeText(formatReportMonth(activeMonth))}</option>`;

  // Build all months summary table
  const allMonthsSummary = buildAllMonthsSummary(months);

  if (!summary.entries.length && !allMonthsSummary.rows.length) {
    panel.innerHTML = `<div class="report-toolbar"><label for="reportMonthSelect">${t("reportMonth")}</label><select id="reportMonthSelect" onchange="changeReportMonth(this.value)">${monthOptions}</select></div><p class="hint">${t("reportMonthEmpty")}</p>`;
    return;
  }

  const dessertRows = summary.dessertRows.length
    ? summary.dessertRows
        .map((row) => {
          const timerCount = summary.timerUsage[row.dessert] || 0;
          return `<tr><td>${escapeText(row.dessert)}</td><td>${row.count}</td><td>${timerCount}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="3">${t("reportNoData")}</td></tr>`;

  const ingredientRows = summary.ingredientRows.length
    ? summary.ingredientRows
        .map(
          (row) =>
            `<tr><td>${escapeText(row.ingredient)}</td><td>${row.count}</td><td>${formatTryPrice(row.firstValue)}</td><td>${formatTryPrice(row.lastValue)}</td><td class="${row.change !== null && row.change > 0 ? "price-up" : row.change !== null && row.change < 0 ? "price-down" : ""}">${row.change === null ? "-" : formatTryPrice(row.change)}</td><td>${escapeText(`${t("reportIncrease")} ${row.increases} / ${t("reportDecrease")} ${row.decreases} / ${t("reportSame")} ${row.same}`)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="6">${t("reportNoData")}</td></tr>`;

  // All months table rows
  const allMonthsRows = allMonthsSummary.rows.length
    ? allMonthsSummary.rows
        .map(
          (row) =>
            `<tr><td>${escapeText(row.month)}</td><td>${row.searchCount}</td><td>${formatTryPrice(row.totalSok)}</td><td>${formatTryPrice(row.totalMigros)}</td><td>${escapeText(row.cheapestMarket)}</td><td>${formatTryPrice(row.cheapestTotal)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="6">${t("reportNoData")}</td></tr>`;

  // Timer usage table rows
  const timerUsageRows =
    Object.entries(summary.timerUsage || {})
      .sort((a, b) => b[1] - a[1])
      .map(
        ([name, count]) =>
          `<tr><td>${escapeText(name)}</td><td>${count}</td></tr>`,
      )
      .join("") || `<tr><td colspan="2">${t("reportNoData")}</td></tr>`;

  panel.innerHTML = `
    <div class="report-toolbar">
      <label for="reportMonthSelect">${t("reportMonth")}</label>
      <select id="reportMonthSelect" onchange="changeReportMonth(this.value)">${monthOptions}</select>
      <button class="btn-export-pdf" onclick="exportReportPDF()">${t("exportPDF")}</button>
      <button class="btn-erase-all" onclick="eraseAllData()">${t("eraseAll")}</button>
    </div>
    <div class="report-card-grid">
      <article class="report-card"><span>${t("reportRuns")}</span><strong>${summary.entries.length}</strong></article>
      <article class="report-card"><span>${t("reportDesserts")}</span><strong>${summary.dessertRows.length}</strong></article>
      <article class="report-card"><span>${t("reportTrackedIngredients")}</span><strong>${summary.ingredientRows.length}</strong></article>
    </div>

    <!-- All Months Comparison Table -->
    <section class="report-section report-section-full">
      <h3>${t("allMonthsComparison")}</h3>
      <div class="report-table-wrap">
        <table class="report-table months-table">
          <thead>
            <tr>
              <th>${t("reportMonth")}</th>
              <th>${t("reportSearchCount")}</th>
              <th>${marketLabel("sok")} ${t("totalCost")}</th>
              <th>${marketLabel("migros")} ${t("totalCost")}</th>
              <th>${t("cheapestMarket")}</th>
              <th>${t("bestPrice")}</th>
            </tr>
          </thead>
          <tbody>${allMonthsRows}</tbody>
        </table>
      </div>
    </section>

    <div class="report-summary-grid">
      <section class="report-section">
        <h3>${t("reportMarketTotals")} - ${escapeText(formatReportMonth(summary.monthKey))}</h3>
        <div class="market-totals">
          <p class="market-total sok"><span class="market-label">${marketLabel("sok")}:</span> <span class="market-value">${formatTryPrice(summary.totals.sok)}</span></p>
          <p class="market-total migros"><span class="market-label">${marketLabel("migros")}:</span> <span class="market-value">${formatTryPrice(summary.totals.migros)}</span></p>
          <p class="market-total savings"><span class="market-label">${t("potentialSavings")}:</span> <span class="market-value">${formatTryPrice(Math.abs(summary.totals.sok - summary.totals.migros))}</span></p>
        </div>
      </section>
      <section class="report-section">
        <h3>${t("reportDessertUsage")}</h3>
        <div class="report-table-wrap">
          <table class="report-table">
            <thead><tr><th>${t("dessert")}</th><th>${t("reportSearchCount")}</th><th>${t("reportTimerUsage")}</th></tr></thead>
            <tbody>${dessertRows}</tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Timer Usage Summary -->
    <section class="report-section report-section-full">
      <h3>${t("timerUsageSummary")}</h3>
      <div class="report-table-wrap">
        <table class="report-table">
          <thead><tr><th>${t("dessert")}</th><th>${t("reportTimerCount")}</th></tr></thead>
          <tbody>${timerUsageRows}</tbody>
        </table>
      </div>
    </section>

    <section class="report-section report-section-full">
      <h3>${t("reportIngredientTrends")}</h3>
      <div class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th>${t("reportIngredientName")}</th>
              <th>${t("reportTimesUsed")}</th>
              <th>${t("reportFirstPrice")}</th>
              <th>${t("reportLastPrice")}</th>
              <th>${t("reportChange")}</th>
              <th>${t("reportMoves")}</th>
            </tr>
          </thead>
          <tbody>${ingredientRows}</tbody>
        </table>
      </div>
    </section>
  `;
}

window.changeReportMonth = function (monthKey) {
  selectedReportMonth = monthKey || currentMonthKey();
  renderMonthlyReport();
};

window.eraseAllData = function () {
  if (!confirm(t("eraseAllConfirm"))) return;
  localStorage.removeItem(LOCAL_KEY);
  localStorage.removeItem(REPORT_KEY);
  localStorage.removeItem(TIMER_USAGE_KEY);
  monthlyReports = {};
  timerUsage = {};
  selectedReportMonth = null;
  desserts = [
    {
      name: "Magnolia",
      days: 5,
      hours: 0,
      minutes: 0,
      startTime: null,
      finished: false,
      notified: false,
      ingredients: [],
    },
    {
      name: "English Cake",
      days: 5,
      hours: 0,
      minutes: 0,
      startTime: null,
      finished: false,
      notified: false,
      ingredients: [],
    },
    {
      name: "Cheese Cake",
      days: 5,
      hours: 0,
      minutes: 0,
      startTime: null,
      finished: false,
      notified: false,
      ingredients: [],
    },
    {
      name: "Tirimasu",
      days: 5,
      hours: 0,
      minutes: 0,
      startTime: null,
      finished: false,
      notified: false,
      ingredients: [],
    },
    {
      name: "Othmaliye",
      days: 10,
      hours: 0,
      minutes: 0,
      startTime: null,
      finished: false,
      notified: false,
      ingredients: [],
    },
    {
      name: "Fondant",
      days: 5,
      hours: 0,
      minutes: 0,
      startTime: null,
      finished: false,
      notified: false,
      ingredients: [],
    },
    {
      name: "Sweet Syrup",
      days: 30,
      hours: 0,
      minutes: 0,
      startTime: null,
      finished: false,
      notified: false,
      ingredients: [],
    },
    {
      name: "Ashta",
      days: 10,
      hours: 0,
      minutes: 0,
      startTime: null,
      finished: false,
      notified: false,
      ingredients: [],
    },
    {
      name: "Cookies",
      days: 5,
      hours: 0,
      minutes: 0,
      startTime: null,
      finished: false,
      notified: false,
      ingredients: [],
    },
  ];
  saveLocal();
  render();
  renderSettings();
  renderDessertSelect();
  renderMonthlyReport();
  alert(t("dataErased"));
};

function buildAllMonthsSummary(months) {
  const rows = months
    .map((month) => {
      const summary = summarizeMonthlyReport(month);
      const searchCount = summary.entries.length;
      const totalSok = summary.totals.sok;
      const totalMigros = summary.totals.migros;
      const cheapestMarket = totalSok <= totalMigros ? "sok" : "migros";
      const cheapestTotal = Math.min(totalSok, totalMigros);
      return {
        month: formatReportMonth(month),
        monthKey: month,
        searchCount,
        totalSok,
        totalMigros,
        cheapestMarket,
        cheapestTotal,
      };
    })
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  return { rows };
}

window.exportReportPDF = function () {
  const months = getReportMonths();
  if (!months.length) {
    alert(t("reportMonthEmpty"));
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const isArabic = currentLang === "ar";
  const activeMonth = selectedReportMonth || months[0];
  const summary = summarizeMonthlyReport(activeMonth);
  const monthName = formatReportMonth(activeMonth);

  function pdfLabel(key) {
    const labels = isArabic
      ? {
          title: "Dessert Cafe Report",
          generated: "Generated",
          currentMonth: "Current Month",
          sokTotal: "Sok Total",
          migrosTotal: "Migros Total",
          savings: "Savings",
          dessertActivity: "Dessert Activity",
          dessert: "Dessert",
          searches: "Searches",
          timerUses: "Timer",
          ingredientTrends: "Price Trends",
          ingredient: "Ingredient",
          used: "Used",
          firstPrice: "First",
          lastPrice: "Last",
          change: "Change",
          moves: "Moves",
          allMonths: "All Months",
          month: "Month",
          count: "Count",
          sok: "Sok",
          migros: "Migros",
          best: "Best",
          price: "Price",
          recentComparisons: "Recent Comparisons",
          date: "Date",
          totalComparisons: "Total Comparisons",
        }
      : {
          title: "Dessert Cafe Report",
          generated: "Generated",
          currentMonth: "Current Month",
          sokTotal: "Sok Total",
          migrosTotal: "Migros Total",
          savings: "Savings",
          dessertActivity: "Dessert Activity",
          dessert: "Dessert",
          searches: "Searches",
          timerUses: "Timer",
          ingredientTrends: "Price Trends",
          ingredient: "Ingredient",
          used: "Used",
          firstPrice: "First",
          lastPrice: "Last",
          change: "Change",
          moves: "Moves",
          allMonths: "All Months",
          month: "Month",
          count: "Count",
          sok: "Sok",
          migros: "Migros",
          best: "Best",
          price: "Price",
          recentComparisons: "Recent Comparisons",
          date: "Date",
          totalComparisons: "Total Comparisons",
        };
    return labels[key] || key;
  }

  // === PAGE 1: Current Month Report ===
  let y = 15;

  doc.setFontSize(16);
  doc.setTextColor(43, 33, 24);
  doc.text(pdfLabel("title"), 105, y, { align: "center" });
  y += 7;

  doc.setFontSize(9);
  doc.setTextColor(118, 101, 84);
  doc.text(
    `${pdfLabel("generated")}: ${new Date().toLocaleDateString(isArabic ? "ar" : "en-GB")}`,
    105,
    y,
    { align: "center" },
  );
  y += 5;

  doc.setFontSize(11);
  doc.setTextColor(43, 33, 24);
  doc.text(`${pdfLabel("currentMonth")}: ${monthName}`, 14, y);
  y += 8;

  doc.setFontSize(9);
  doc.text(
    `${pdfLabel("sokTotal")}: ${summary.totals.sok.toFixed(2)} TL`,
    14,
    y,
  );
  y += 5;
  doc.text(
    `${pdfLabel("migrosTotal")}: ${summary.totals.migros.toFixed(2)} TL`,
    14,
    y,
  );
  y += 5;
  doc.text(
    `${pdfLabel("savings")}: ${Math.abs(summary.totals.sok - summary.totals.migros).toFixed(2)} TL`,
    14,
    y,
  );
  y += 10;

  // Dessert Activity Table
  doc.setFontSize(10);
  doc.text(pdfLabel("dessertActivity"), 14, y);
  y += 3;

  const dessertData = summary.dessertRows.map((r) => {
    const timerCount = summary.timerUsage[r.dessert] || 0;
    return [r.dessert, String(r.count), String(timerCount)];
  });

  doc.autoTable({
    startY: y,
    head: [[pdfLabel("dessert"), pdfLabel("searches"), pdfLabel("timerUses")]],
    body: dessertData,
    theme: "grid",
    headStyles: { fillColor: [15, 118, 110], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [255, 248, 239] },
    margin: { left: 14, right: 14 },
    tableWidth: 180,
  });

  y = doc.lastAutoTable.finalY + 8;

  // Ingredient Trends Table
  doc.setFontSize(10);
  doc.text(pdfLabel("ingredientTrends"), 14, y);
  y += 3;

  const ingredientData = summary.ingredientRows.map((r) => [
    r.ingredient,
    String(r.count),
    r.firstValue !== null ? `${r.firstValue.toFixed(2)} TL` : "-",
    r.lastValue !== null ? `${r.lastValue.toFixed(2)} TL` : "-",
    r.change !== null ? `${r.change.toFixed(2)} TL` : "-",
    `+${r.increases}/-${r.decreases}`,
  ]);

  doc.autoTable({
    startY: y,
    head: [
      [
        pdfLabel("ingredient"),
        pdfLabel("used"),
        pdfLabel("firstPrice"),
        pdfLabel("lastPrice"),
        pdfLabel("change"),
        pdfLabel("moves"),
      ],
    ],
    body: ingredientData,
    theme: "grid",
    headStyles: { fillColor: [233, 120, 39], fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 239, 228] },
    margin: { left: 14, right: 14 },
    tableWidth: 180,
  });

  // === PAGE 2: All Months Summary ===
  doc.addPage();
  y = 15;

  doc.setFontSize(14);
  doc.setTextColor(43, 33, 24);
  doc.text(pdfLabel("allMonths"), 14, y);
  y += 8;

  const allMonthsSummary = buildAllMonthsSummary(months);
  let grandTotalSok = 0;
  let grandTotalMigros = 0;
  let totalSearches = 0;

  allMonthsSummary.rows.forEach((r) => {
    grandTotalSok += r.totalSok;
    grandTotalMigros += r.totalMigros;
    totalSearches += r.searchCount;
  });

  doc.setFontSize(9);
  doc.text(`${pdfLabel("totalComparisons")}: ${totalSearches}`, 14, y);
  y += 5;
  doc.text(`${pdfLabel("sokTotal")}: ${grandTotalSok.toFixed(2)} TL`, 14, y);
  y += 5;
  doc.text(
    `${pdfLabel("migrosTotal")}: ${grandTotalMigros.toFixed(2)} TL`,
    14,
    y,
  );
  y += 5;
  doc.text(
    `${pdfLabel("savings")}: ${Math.abs(grandTotalSok - grandTotalMigros).toFixed(2)} TL`,
    14,
    y,
  );
  y += 8;

  const monthsTableData = allMonthsSummary.rows.map((r) => [
    r.monthKey,
    String(r.searchCount),
    `${r.totalSok.toFixed(2)}`,
    `${r.totalMigros.toFixed(2)}`,
    r.cheapestMarket === "sok" ? pdfLabel("sok") : pdfLabel("migros"),
    `${r.cheapestTotal.toFixed(2)} TL`,
  ]);

  doc.autoTable({
    startY: y,
    head: [
      [
        pdfLabel("month"),
        pdfLabel("count"),
        pdfLabel("sok"),
        pdfLabel("migros"),
        pdfLabel("best"),
        pdfLabel("price"),
      ],
    ],
    body: monthsTableData,
    theme: "grid",
    headStyles: { fillColor: [233, 120, 39], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 239, 228] },
    margin: { left: 14, right: 14 },
    tableWidth: 180,
  });

  y = doc.lastAutoTable.finalY + 8;

  if (summary.entries.length > 0) {
    doc.setFontSize(10);
    doc.text(pdfLabel("recentComparisons"), 14, y);
    y += 3;

    const runsData = summary.entries
      .slice(-10)
      .map((entry, idx) => [
        String(idx + 1),
        new Date(entry.timestamp).toLocaleDateString(isArabic ? "ar" : "en-GB"),
        entry.dessertName,
        `${entry.totals.sok.toFixed(2)}`,
        `${entry.totals.migros.toFixed(2)}`,
        entry.cheapestMarket === "sok" ? pdfLabel("sok") : pdfLabel("migros"),
      ]);

    doc.autoTable({
      startY: y,
      head: [
        [
          "#",
          pdfLabel("date"),
          pdfLabel("dessert"),
          pdfLabel("sok"),
          pdfLabel("migros"),
          pdfLabel("best"),
        ],
      ],
      body: runsData,
      theme: "grid",
      headStyles: { fillColor: [15, 118, 110], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [255, 248, 239] },
      margin: { left: 14, right: 14 },
      tableWidth: 180,
    });
  }

  doc.save(`dessert-cafe-report-${new Date().toISOString().slice(0, 10)}.pdf`);
};

let desserts = [
  {
    name: "Magnolia",
    days: 5,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    notified: false,
    ingredients: [],
  },
  {
    name: "English Cake",
    days: 5,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    notified: false,
    ingredients: [],
  },
  {
    name: "Cheese Cake",
    days: 5,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    notified: false,
    ingredients: [],
  },
  {
    name: "Tirimasu",
    days: 5,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    notified: false,
    ingredients: [],
  },
  {
    name: "Othmaliye",
    days: 10,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    notified: false,
    ingredients: [],
  },
  {
    name: "Fondant",
    days: 5,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    notified: false,
    ingredients: [],
  },
  {
    name: "Sweet Syrup",
    days: 30,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    notified: false,
    ingredients: [],
  },
  {
    name: "Ashta",
    days: 10,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    notified: false,
    ingredients: [],
  },
  {
    name: "Cookies",
    days: 5,
    hours: 0,
    minutes: 0,
    startTime: null,
    finished: false,
    notified: false,
    ingredients: [],
  },
];

let retryCount = 0,
  serverFound = false;

async function detectServerPort() {
  const hostname = window.location.hostname;
  const ls = document.getElementById("loadingStatus"),
    lt = document.getElementById("loadingText"),
    rc = document.getElementById("retryCounter");
  if (window.location.protocol === "file:") {
    if (ls) {
      ls.className = "loading-status waiting";
      ls.innerHTML = `Open <a href="http://localhost:5050" style="color:#c89b6d">http://localhost:5050</a> ${t("fromLabel")} ${t("startServerFirst").replace("!", "").toLowerCase()}`;
    }
    if (lt) lt.textContent = t("startServerFirst");
    if (rc) rc.textContent = t("runStartBat");
    return false;
  }
  if (ls) {
    ls.className = "loading-status connecting";
    ls.textContent = t("checkingConnection");
  }
  const isCloud =
    hostname.includes("netlify") ||
    hostname.includes("onrender") ||
    (window.location.protocol === "https:" &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1");
  if (isCloud) {
    SCRAPER_API_BASE = window.location.origin;
    serverFound = true;
    return true;
  }
  const isNet = hostname !== "localhost" && hostname !== "127.0.0.1";
  if (isNet) {
    for (const port of PORTS_TO_TRY) {
      try {
        const r = await fetch(
          `${window.location.protocol}//${hostname}:${port}/health`,
          { signal: AbortSignal.timeout(2000) },
        );
        if (r.ok) {
          SCRAPER_API_BASE = `${window.location.protocol}//${hostname}:${port}`;
          serverFound = true;
          return true;
        }
      } catch (_) {}
    }
  }
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    try {
      const r = await fetch(`${window.location.origin}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (r.ok) {
        SCRAPER_API_BASE = window.location.origin;
        serverFound = true;
        if (ls) {
          ls.className = "loading-status connected";
          ls.textContent = t("connected");
        }
        return true;
      }
    } catch (_) {}
    for (const port of PORTS_TO_TRY) {
      try {
        const r = await fetch(
          `${window.location.protocol}//localhost:${port}/health`,
          { signal: AbortSignal.timeout(2000) },
        );
        if (r.ok) {
          SCRAPER_API_BASE = `${window.location.protocol}//localhost:${port}`;
          serverFound = true;
          if (ls) {
            ls.className = "loading-status connected";
            ls.textContent = `${t("portLabel")} ${port}`;
          }
          return true;
        }
      } catch (_) {}
    }
  }
  retryCount++;
  if (ls) {
    ls.className = "loading-status waiting";
    ls.innerHTML = `${t("serverNotRunning").replace("start.bat", "<b>start.bat</b>")}`;
  }
  if (lt) lt.textContent = t("serverNotFound");
  return false;
}

function loadLocal() {
  const r = localStorage.getItem(LOCAL_KEY);
  if (!r) return;
  try {
    const p = JSON.parse(r);
    if (Array.isArray(p)) {
      desserts = p.map((d) => ({
        ...d,
        ingredients: (Array.isArray(d.ingredients) ? d.ingredients : []).map(
          normalizeIngredient,
        ),
      }));
      saveLocal();
    }
  } catch (_) {}
}
function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(desserts));
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++)
    outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function getPushPublicKey() {
  if (pushStatus.checked) return pushStatus;

  const res = await fetch(`${SCRAPER_API_BASE}/push-public-key`);
  const data = await res.json();
  pushStatus = {
    checked: true,
    supported: Boolean(res.ok && data.publicKey),
    publicKey: data.publicKey || null,
    firebaseConfig: data.firebaseConfig || FIREBASE_CONFIG_FALLBACK,
    reason: data.error || data.reason || null,
  };
  return pushStatus;
}

async function ensurePushAvailability() {
  const status = await getPushPublicKey();
  if (!status.supported || !status.publicKey) {
    throw new Error(status.reason || t("pushNotConfigured"));
  }
  return status;
}

async function ensurePushSubscription() {
  if (!("serviceWorker" in navigator)) {
    throw new Error(t("pushUnsupportedDevice"));
  }

  const push = await ensurePushAvailability();
  if (pushToken) return pushToken;

  const [{ initializeApp }, { getMessaging, getToken }] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js"),
  ]);

  const firebaseApp = initializeApp(
    push.firebaseConfig || FIREBASE_CONFIG_FALLBACK,
  );
  const registration = await navigator.serviceWorker.register("/sw.js");
  const messaging = getMessaging(firebaseApp);
  pushToken = await getToken(messaging, {
    vapidKey: push.publicKey,
    serviceWorkerRegistration: registration,
  });

  if (!pushToken) {
    throw new Error(t("pushFailedToken"));
  }

  return pushToken;
}

async function syncTimerPush(index) {
  if (
    !notificationsEnabled ||
    Notification.permission !== "granted" ||
    !SCRAPER_API_BASE
  )
    return;
  if (!pushToken) {
    try {
      await ensurePushSubscription();
    } catch (_) {
      return;
    }
  }

  const dessert = desserts[index];
  if (!dessert) return;

  const tag = `dessert-${dessert.name}`;

  if (!dessert.startTime || dessert.finished) {
    await fetch(`${SCRAPER_API_BASE}/push-cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: pushToken, tag }),
    });
    return;
  }

  const sendAt =
    dessert.startTime +
    dessert.days * 86400000 +
    dessert.hours * 3600000 +
    dessert.minutes * 60000;
  await fetch(`${SCRAPER_API_BASE}/push-schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: pushToken,
      sendAt,
      payload: {
        title: `${t("timeFinished")} ${dessert.name}`,
        body: `Your ${dessert.name} dessert timer has finished!`,
        tag,
        url: window.location.href,
      },
    }),
  });
}

async function cancelTimerPush(index) {
  if (!pushToken || !SCRAPER_API_BASE) return;
  const dessert = desserts[index];
  if (!dessert) return;

  await fetch(`${SCRAPER_API_BASE}/push-cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: pushToken,
      tag: `dessert-${dessert.name}`,
    }),
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  currentLang = localStorage.getItem("app_lang") || "en";
  document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = currentLang;
  const lt = document.getElementById("loadingText");
  if (lt) lt.textContent = t("checkingConnection");
  const connected = await detectServerPort();
  if (!connected || !serverFound) return;
  loadLocal();
  loadReports();
  loadTimerUsage();
  renderLanguageSwitcher();
  translateUI();
  const emailEl = document.getElementById("email"),
    passwordEl = document.getElementById("password");
  if (emailEl) emailEl.value = AUTO_EMAIL;
  if (passwordEl) passwordEl.value = AUTO_PASSWORD;
  const loginBtn = document.querySelector("#login button");
  if (loginBtn)
    loginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.login();
    });
  if (emailEl)
    emailEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") window.login();
    });
  if (passwordEl)
    passwordEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") window.login();
    });
  const ls = document.getElementById("loadingScreen");
  if (ls) ls.classList.add("hidden");
});

function normalizeIngredient(ing) {
  const marketSelections =
    ing?.marketSelections && typeof ing.marketSelections === "object"
      ? ing.marketSelections
      : {};
  return {
    name: String(ing?.name || ""),
    quantity: Number.isFinite(Number(ing?.quantity)) ? Number(ing.quantity) : 1,
    unit: String(ing?.unit || "piece"),
    description: String(ing?.description || ""),
    packageSize: Number.isFinite(Number(ing?.packageSize))
      ? Number(ing.packageSize)
      : 1,
    packageUnit: String(ing?.packageUnit || "piece"),
    marketSelections: {
      sok: marketSelections.sok
        ? {
            market: "sok",
            name: String(marketSelections.sok.name || ""),
            packageSize: Number.isFinite(
              Number(marketSelections.sok.packageSize),
            )
              ? Number(marketSelections.sok.packageSize)
              : null,
            packageUnit: String(marketSelections.sok.packageUnit || ""),
          }
        : null,
      migros: marketSelections.migros
        ? {
            market: "migros",
            name: String(marketSelections.migros.name || ""),
            packageSize: Number.isFinite(
              Number(marketSelections.migros.packageSize),
            )
              ? Number(marketSelections.migros.packageSize)
              : null,
            packageUnit: String(marketSelections.migros.packageUnit || ""),
          }
        : null,
    },
  };
}

function buildIngredientSearchQuery(name, description) {
  return [(name || "").trim(), (description || "").trim()]
    .filter(Boolean)
    .join(" ")
    .trim();
}

window.login = function () {
  const email = (document.getElementById("email").value || "").trim(),
    password = document.getElementById("password").value || "";
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
  renderMonthlyReport();
  switchTab("timer");
  initNotifications();
  if (notificationsEnabled && Notification.permission === "granted") {
    ensurePushSubscription().catch(() => {
      notificationsEnabled = false;
      localStorage.setItem("notif_enabled", "false");
      initNotifications();
    });
  }
}

function triggerDessertFinishedAlert(dessert) {
  if (!dessert || dessert.notified || dessert.notifyInFlight) return;

  dessert.notifyInFlight = true;
  showChromeNotification(
    `${t("timeFinished")} ${dessert.name}`,
    `Your ${dessert.name} dessert timer has finished!`,
    `dessert-${dessert.name}`,
  )
    .then((sent) => {
      dessert.notifyInFlight = false;
      if (sent) {
        dessert.notified = true;
        saveLocal();
      }
    })
    .catch(() => {
      dessert.notifyInFlight = false;
    });
}

window.switchTab = function (tabName) {
  ["timer", "market", "settings", "reports"].forEach((tab) => {
    const el = document.getElementById(`tab-${tab}`);
    if (el) el.classList.toggle("hidden", tab !== tabName);
  });
};

function render() {
  const list = document.getElementById("list"),
    expired = document.getElementById("expired");
  list.innerHTML = "";
  expired.innerHTML = "";
  const now = Date.now();
  desserts.forEach((d, i) => {
    let remaining = 0;
    if (d.startTime)
      remaining =
        d.days * 86400000 +
        d.hours * 3600000 +
        d.minutes * 60000 -
        (now - d.startTime);
    if (d.startTime && remaining <= 0 && !d.finished) {
      d.finished = true;
      const alarm = document.getElementById("alarm");
      if (alarm) alarm.play().catch(() => {});
      saveLocal();
    }
    if (d.startTime && remaining <= 0) triggerDessertFinishedAlert(d);
    const div = document.createElement("div");
    div.className = "row";
    div.innerHTML = `<span>${d.name}</span><button onclick="start(${i})">${t("startBtn")}</button><button onclick="reset(${i})">${t("resetBtn")}</button><span>${d.startTime ? formatTime(Math.max(0, remaining)) : ""}</span>`;
    if (d.finished || (d.startTime && remaining <= 0)) expired.appendChild(div);
    else list.appendChild(div);
  });
}

window.start = function (i) {
  desserts[i].startTime = Date.now();
  desserts[i].finished = false;
  desserts[i].notified = false;
  desserts[i].notifyInFlight = false;
  recordTimerUsage(desserts[i].name);
  render();
  saveLocal();
  syncTimerPush(i).catch(() => {});
};
window.reset = function (i) {
  desserts[i].startTime = null;
  desserts[i].finished = false;
  desserts[i].notified = false;
  desserts[i].notifyInFlight = false;
  render();
  saveLocal();
  syncTimerPush(i).catch(() => {});
};
function formatTime(ms) {
  const s = Math.floor(ms / 1000),
    d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}

setInterval(render, 1000);

function renderSettings() {
  const panel = document.getElementById("settings");
  panel.innerHTML = "";
  desserts.forEach((d, i) => {
    const row = document.createElement("div");
    row.className = "settings-row";
    row.innerHTML = `<span class="settings-name">${d.name}</span><input type="number" value="${d.days}" min="0" id="days_${i}"> ${t("days")}<input type="number" value="${d.hours}" min="0" max="23" id="hours_${i}"> ${t("hours")}<input type="number" value="${d.minutes}" min="0" max="59" id="min_${i}"> ${t("minutes")}<button onclick="saveAdmin(${i})">${t("saveBtn")}</button><button class="btn-delete" onclick="deleteDessert(${i})">${t("deleteBtn")}</button>`;
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
  desserts[i].days = Math.max(
    0,
    parseInt(document.getElementById(`days_${i}`).value, 10) || 0,
  );
  desserts[i].hours = Math.max(
    0,
    Math.min(
      23,
      parseInt(document.getElementById(`hours_${i}`).value, 10) || 0,
    ),
  );
  desserts[i].minutes = Math.max(
    0,
    Math.min(59, parseInt(document.getElementById(`min_${i}`).value, 10) || 0),
  );
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

let _pickTarget = null;
let _pickState = {
  query: "",
  results: null,
  quantity: 1,
  quantityUnit: "piece",
  draftSelections: { sok: null, migros: null },
};
function currentPickSelections() {
  return _pickState?.draftSelections || { sok: null, migros: null };
}
window.openPickModal = async function (dessertIndex, ingredientIndex) {
  _pickTarget = { dessertIndex, ingredientIndex };
  const nameEl = document.getElementById(
    `ing_name_${dessertIndex}_${ingredientIndex}`,
  );
  const descEl = document.getElementById(
    `ing_desc_${dessertIndex}_${ingredientIndex}`,
  );
  const unitEl = document.getElementById(
    `ing_unit_${dessertIndex}_${ingredientIndex}`,
  );
  const qtyEl = document.getElementById(
    `ing_qty_${dessertIndex}_${ingredientIndex}`,
  );
  const ing = normalizeIngredient(
    desserts[dessertIndex]?.ingredients?.[ingredientIndex],
  );
  const modal = document.getElementById("pickModal"),
    searchInput = document.getElementById("pickSearchInput"),
    qtyInput = document.getElementById("pickQuantityInput"),
    qtyUnit = document.getElementById("pickQuantityUnit"),
    resultsBox = document.getElementById("pickResults");
  const searchQuery =
    buildIngredientSearchQuery(nameEl?.value, descEl?.value) ||
    buildIngredientSearchQuery(ing.name, ing.description);
  _pickState = {
    query: searchQuery,
    results: null,
    quantity: Number(qtyEl?.value || "1") || 1,
    quantityUnit: unitEl?.value || "piece",
    draftSelections: {
      sok: ing.marketSelections?.sok ? { ...ing.marketSelections.sok } : null,
      migros: ing.marketSelections?.migros
        ? { ...ing.marketSelections.migros }
        : null,
    },
  };
  searchInput.value = searchQuery;
  resultsBox.innerHTML = "";
  modal.classList.remove("hidden");
  if (qtyInput) qtyInput.value = qtyEl?.value || "1";
  if (qtyUnit) qtyUnit.value = unitEl?.value || "piece";
  if (searchInput.value) await runPickSearch(searchInput.value);
};
window.closePickModal = function () {
  document.getElementById("pickModal").classList.add("hidden");
  _pickTarget = null;
  _pickState = {
    query: "",
    results: null,
    quantity: 1,
    quantityUnit: "piece",
    draftSelections: { sok: null, migros: null },
  };
};
window.clearPickResults = function () {
  _pickState = { ..._pickState, results: null };
  document.getElementById("pickResults").innerHTML = "";
};
window.pickSearchKeydown = function (e) {
  if (e.key === "Enter")
    runPickSearch(document.getElementById("pickSearchInput").value.trim());
};

window.runPickSearch = async function (query) {
  if (!query) return;
  if (!SCRAPER_API_BASE) await detectServerPort();
  const quantity = Math.max(
    0.01,
    Number(document.getElementById("pickQuantityInput")?.value || "1"),
  );
  const quantityUnit =
    document.getElementById("pickQuantityUnit")?.value || "piece";
  const resultsBox = document.getElementById("pickResults");
  resultsBox.innerHTML = `<p class="pick-loading">🔍 ${t("searchingFor")} "<strong>${query}</strong>"…</p>`;
  try {
    const res = await fetch(`${SCRAPER_API_BASE}/search-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product: query }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    _pickState = {
      ..._pickState,
      query,
      results: data,
      quantity,
      quantityUnit,
    };
    renderPickResults(data, quantity, quantityUnit);
  } catch (err) {
    resultsBox.innerHTML = `<p class="pick-error">Error: ${err.message}</p>`;
  }
};

function renderPickResults(data, quantity = 1, quantityUnit = "piece") {
  const resultsBox = document.getElementById("pickResults");
  const markets = [
    { key: "sok", label: "Şok", color: "#e67e22" },
    { key: "migros", label: "Migros", color: "#2980b9" },
  ];
  const selections = currentPickSelections();
  const requiredMarkets = markets
    .filter(({ key }) => Array.isArray(data[key]) && data[key].length > 0)
    .map(({ key }) => key);
  const ready =
    requiredMarkets.length > 0 &&
    requiredMarkets.every((market) => selections[market]?.name);
  let html = '<div class="pick-markets-container">';
  html += `<div class="pick-selection-banner"><div class="pick-selection-title">${t("pickChooseBoth")}</div><div class="pick-selection-status">${t("pickSelectedFrom")} Sok: <strong>${escapeText(selections.sok?.name || "None")}</strong></div><div class="pick-selection-status">${t("pickSelectedFrom")} Migros: <strong>${escapeText(selections.migros?.name || "None")}</strong></div><div class="${ready ? "pick-selection-ready" : "pick-selection-pending"}">${ready ? t("pickSelectionReady") : t("pickNeedOtherMarket")}</div></div>`;
  markets.forEach(({ key, label, color }) => {
    const items = data[key];
    html += `<div class="pick-market-section"><div class="pick-market-header" style="background:${color}"><span>${label} (${Array.isArray(items) ? items.length : 0})</span></div><div class="pick-market-items">`;
    if (!items || !items.length)
      html += `<div class="pick-no-result">${t("noResultsFound")}</div>`;
    else
      items.forEach((item) => {
        const packageInfo = extractPackageFromName(item.name);
        const img = item.image
          ? `<img src="${item.image}" alt="" onerror="this.parentElement.innerHTML='<span>📦</span>'">`
          : "<span>📦</span>";
        const estimated = estimateItemCost(
          item.price,
          quantity,
          quantityUnit,
          packageInfo,
        );
        const packageLabel = packageInfo
          ? `${packageInfo.size} ${packageInfo.unit}`
          : "1 piece";
        const selectedName = selections[key]?.name || "";
        const isSelected = selectedName && selectedName === item.name;
        html += `<div class="pick-product-card ${isSelected ? "selected" : ""}"><div class="pick-product-img">${img}</div><div class="pick-product-info"><div class="pick-product-name">${escapeText(item.name)}</div><div class="pick-product-price">${formatTryPrice(item.price)}</div><div class="pick-product-total">${t("estimatedCost")} (${quantity} ${escapeText(quantityUnit)} from ${escapeText(packageLabel)}): ${formatTryPrice(estimated)}</div></div><button class="pick-select-btn" data-market="${escapeAttr(key)}" data-name="${escapeAttr(item.name)}" data-pack-size="${escapeAttr(packageInfo?.size || "")}" data-pack-unit="${escapeAttr(packageInfo?.unit || "")}">${isSelected ? "Selected" : t("select")}</button></div>`;
      });
    html += `</div></div>`;
  });
  html += `</div><div class="pick-confirm-row"><button class="pick-confirm-btn" ${ready ? "" : "disabled"} onclick="confirmPickedItems()">${t("pickSaveBoth")}</button></div>`;
  resultsBox.innerHTML = html;
  resultsBox.querySelectorAll(".pick-select-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      applyPickedItem(
        btn.dataset.market,
        btn.dataset.name,
        btn.dataset.packSize,
        btn.dataset.packUnit,
      ),
    );
  });
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
window.applyPickedItem = function (
  market,
  name,
  price,
  packageSize,
  packageUnit,
) {
  if (!_pickTarget) return;
  _pickState.draftSelections[market] = {
    market,
    name,
    price: Number.isFinite(Number(price)) ? Number(price) : null,
    packageSize: packageSize ? Number(packageSize) : null,
    packageUnit: packageUnit || "",
  };
  if (_pickState.results) {
    renderPickResults(
      _pickState.results,
      _pickState.quantity,
      _pickState.quantityUnit,
    );
  }
};

window.confirmPickedItems = function () {
  if (!_pickTarget || !_pickState.results) return;
  const requiredMarkets = ["sok", "migros"].filter(
    (market) =>
      Array.isArray(_pickState.results[market]) &&
      _pickState.results[market].length > 0,
  );
  if (
    !requiredMarkets.every((market) => _pickState.draftSelections[market]?.name)
  ) {
    alert(t("pickNeedOtherMarket"));
    return;
  }
  const el = document.getElementById(
    `ing_name_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const descEl = document.getElementById(
    `ing_desc_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const qtyEl = document.getElementById(
    `ing_qty_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const unitEl = document.getElementById(
    `ing_unit_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const packEl = document.getElementById(
    `ing_pack_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const packUnitEl = document.getElementById(
    `ing_pack_unit_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const qtyInput = document.getElementById("pickQuantityInput");
  const qtyUnit = document.getElementById("pickQuantityUnit");
  const ing = normalizeIngredient(
    desserts[_pickTarget.dessertIndex]?.ingredients?.[
      _pickTarget.ingredientIndex
    ],
  );
  const selectedName =
    _pickState.draftSelections.sok?.name ||
    _pickState.draftSelections.migros?.name ||
    "";
  const nextName = (el?.value || "").trim() || _pickState.query || selectedName;
  const nextDescription = (descEl?.value || "").trim();
  const nextQuantity = Math.max(
    0.01,
    Number(qtyInput?.value || qtyEl?.value || ing.quantity || 1),
  );
  const nextUnit = qtyUnit?.value || unitEl?.value || ing.unit || "piece";
  const packSource =
    _pickState.draftSelections.sok || _pickState.draftSelections.migros;
  const nextPackageSize =
    Number(packSource?.packageSize || packEl?.value || ing.packageSize || 1) ||
    1;
  const nextPackageUnit =
    packSource?.packageUnit || packUnitEl?.value || ing.packageUnit || "piece";
  const nextIngredient = {
    ...ing,
    name: nextName,
    description: nextDescription,
    quantity: nextQuantity,
    unit: nextUnit,
    packageSize: nextPackageSize,
    packageUnit: nextPackageUnit,
    marketSelections: {
      sok: _pickState.draftSelections.sok
        ? { ..._pickState.draftSelections.sok }
        : null,
      migros: _pickState.draftSelections.migros
        ? { ..._pickState.draftSelections.migros }
        : null,
    },
  };
  desserts[_pickTarget.dessertIndex].ingredients[_pickTarget.ingredientIndex] =
    nextIngredient;
  if (el) el.value = nextName;
  if (descEl) descEl.value = nextDescription;
  if (qtyEl) qtyEl.value = String(nextQuantity);
  if (unitEl) unitEl.value = nextUnit;
  if (packEl) packEl.value = String(nextPackageSize);
  if (packUnitEl) packUnitEl.value = nextPackageUnit;
  saveLocal();
  renderSettings();
  renderDessertSelect();
  closePickModal();
};

function renderIngredientsSettings() {
  const panel = document.getElementById("ingredientsSettings");
  panel.innerHTML = "";
  desserts.forEach((dessert, di) => {
    const wrapper = document.createElement("div");
    wrapper.className = "panel";
    wrapper.innerHTML = `<div class="ing-header"><h3>${dessert.name}</h3><div class="ing-header-btns"><button onclick="addIngredient(${di})">${t("addIngredientBtn")}</button></div></div><div id="ingredients_${di}" class="ingredients-list"></div>`;
    panel.appendChild(wrapper);
    const list = wrapper.querySelector(`#ingredients_${di}`);
    const ings = Array.isArray(dessert.ingredients) ? dessert.ingredients : [];
    if (!ings.length) {
      const empty = document.createElement("div");
      empty.className = "no-ingredients";
      empty.textContent = t("noIngredientsYet");
      list.appendChild(empty);
      return;
    }
    ings.forEach((ing, ii) => {
      const s = normalizeIngredient(ing),
        row = document.createElement("div");
      row.className = "ingredient-row";
      const sokPicked = s.marketSelections?.sok?.name
        ? escapeText(s.marketSelections.sok.name)
        : "";
      const migrosPicked = s.marketSelections?.migros?.name
        ? escapeText(s.marketSelections.migros.name)
        : "";
      const pickedSummary =
        sokPicked || migrosPicked
          ? `<div class="picked-market-summary">${sokPicked ? `<span>Şok: ${sokPicked}</span>` : ""}${migrosPicked ? `<span>Migros: ${migrosPicked}</span>` : ""}</div>`
          : "";
      row.innerHTML = `<input type="text" id="ing_name_${di}_${ii}" placeholder="${t("ingredientName")}" value="${s.name}"><input type="text" id="ing_desc_${di}_${ii}" placeholder="${t("description")}" value="${s.description}"><input type="number" step="0.01" min="0.01" id="ing_qty_${di}_${ii}" placeholder="${t("need")}" value="${s.quantity}"><select id="ing_unit_${di}_${ii}">${renderUnitOptions(s.unit)}</select><span>${t("perPackage")}</span><input type="number" step="0.01" min="0.01" id="ing_pack_${di}_${ii}" placeholder="${t("packSize")}" value="${s.packageSize}"><select id="ing_pack_unit_${di}_${ii}">${renderUnitOptions(s.packageUnit)}</select><button class="btn-pick" onclick="openPickModal(${di},${ii})">${t("pickFromMarket")}</button><button onclick="saveIngredient(${di},${ii})">${t("saveBtn")}</button><button onclick="openMarketLink('sok',${di},${ii})">${t("openSok")}</button><button onclick="openMarketLink('migros',${di},${ii})">${t("openMigros")}</button><button class="btn-delete" onclick="removeIngredient(${di},${ii})">${t("deleteBtn")}</button>${pickedSummary}`;
      list.appendChild(row);
    });
  });
}

window.addIngredient = function (di) {
  if (!Array.isArray(desserts[di].ingredients)) desserts[di].ingredients = [];
  desserts[di].ingredients.push({
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

window.saveIngredient = function (di, ii) {
  const nameEl = document.getElementById(`ing_name_${di}_${ii}`),
    descEl = document.getElementById(`ing_desc_${di}_${ii}`),
    qtyEl = document.getElementById(`ing_qty_${di}_${ii}`),
    unitEl = document.getElementById(`ing_unit_${di}_${ii}`),
    packEl = document.getElementById(`ing_pack_${di}_${ii}`),
    packUnitEl = document.getElementById(`ing_pack_unit_${di}_${ii}`);
  if (!nameEl || !qtyEl || !unitEl || !packEl || !packUnitEl) {
    alert("Reopen Settings tab.");
    return;
  }
  const name = (nameEl.value || "").trim(),
    description = (descEl?.value || "").trim(),
    quantity = parseFloat(qtyEl.value || "0"),
    unit = unitEl.value || "piece",
    packageSize = parseFloat(packEl.value || "0"),
    packageUnit = packUnitEl.value || "piece";
  if (!name) return alert(t("ingredientNameRequired"));
  if (!Number.isFinite(quantity) || quantity <= 0)
    return alert(t("quantityMustBeGreater"));
  if (!Number.isFinite(packageSize) || packageSize <= 0)
    return alert(t("packageSizeMustBeGreater"));
  const existing = normalizeIngredient(desserts[di].ingredients[ii]);
  desserts[di].ingredients[ii] = {
    name,
    description,
    quantity,
    unit,
    packageSize,
    packageUnit,
    marketSelections: existing.marketSelections,
  };
  saveLocal();
  alert(t("ingredientSaved"));
  renderSettings();
  renderDessertSelect();
};

window.removeIngredient = function (di, ii) {
  desserts[di].ingredients.splice(ii, 1);
  saveLocal();
  renderSettings();
  renderDessertSelect();
};

function renderDessertSelect() {
  const select = document.getElementById("dessertSelect");
  if (!select) return;
  select.innerHTML = "";
  desserts.forEach((d, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = d.name;
    select.appendChild(o);
  });
}

window.findCheapestForSelectedDessert = async function () {
  if (!SCRAPER_API_BASE) await detectServerPort();
  const select = document.getElementById("dessertSelect"),
    resultBox = document.getElementById("marketResult"),
    idx = Number(select?.value ?? -1),
    dessert = desserts[idx];
  if (!dessert) return (resultBox.innerHTML = `<p>${t("selectDessert")}</p>`);
  const ingredients = (dessert.ingredients || [])
    .map((raw) => {
      const ing = normalizeIngredient(raw);
      const baseName = [ing.name, ing.description]
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        name: baseName,
        marketNames: {
          sok: ing.marketSelections?.sok?.name || baseName,
          migros: ing.marketSelections?.migros?.name || baseName,
        },
        quantity: calculateEffectiveQuantity(
          ing.quantity,
          ing.unit,
          ing.packageSize,
          ing.packageUnit,
        ),
        displayQuantity: `${ing.quantity} ${ing.unit} (pack ${ing.packageSize} ${ing.packageUnit})`,
      };
    })
    .filter((ing) => ing.name && ing.quantity > 0);
  if (!ingredients.length) {
    resultBox.innerHTML = `<p>${t("addIngredientsFirst")}</p>`;
    return;
  }
  resultBox.innerHTML = `<p>${t("searching")}</p>`;
  try {
    const res = await fetch(`${SCRAPER_API_BASE}/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredients }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    renderMarketResult(await res.json());
  } catch (err) {
    resultBox.innerHTML = `<p>${t("marketServiceError")}: ${err.message}</p>`;
  }
};

function renderMarketResult(data) {
  const resultBox = document.getElementById("marketResult"),
    rows = Array.isArray(data.rows) ? data.rows : [],
    totals = data.totals || {},
    cheapest = data.cheapestMarket || "N/A",
    cheapestTotal = Number(data.cheapestTotal || 0);
  let html = `<table class="market-table"><thead><tr><th>${t("ingredient")}</th><th>${t("qty")}</th><th>Şok ${t("unit")}</th><th>Şok ${t("cost")}</th><th>Migros ${t("unit")}</th><th>Migros ${t("cost")}</th></tr></thead><tbody>`;
  rows.forEach((r) => {
    html += `<tr><td>${r.ingredient}</td><td>${r.quantity}</td><td>${formatTryPrice(r.sok?.unitPrice)}</td><td>${formatTryPrice(r.sok?.cost)}</td><td>${formatTryPrice(r.migros?.unitPrice)}</td><td>${formatTryPrice(r.migros?.cost)}</td></tr>`;
  });
  html += `</tbody></table><p><strong>${t("totalSok")}:</strong> ${formatTryPrice(totals.sok)}</p><p><strong>${t("totalMigros")}:</strong> ${formatTryPrice(totals.migros)}</p><p class="best-market">${t("cheapestMarket")}: ${cheapest} (${formatTryPrice(cheapestTotal)})</p>`;
  resultBox.innerHTML = html;
}

window.openMarketLink = function (market, di, ii) {
  const nameEl = document.getElementById(`ing_name_${di}_${ii}`),
    descEl = document.getElementById(`ing_desc_${di}_${ii}`);
  const query = buildIngredientSearchQuery(nameEl?.value, descEl?.value);
  if (!query) {
    alert(t("writeIngredientFirst"));
    return;
  }
  const urls = {
    sok: `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(query)}`,
    migros: `https://www.migros.com.tr/arama?q=${encodeURIComponent(query)}`,
  };
  if (urls[market]) window.open(urls[market], "_blank");
};

function renderUnitOptions(sel) {
  return ["g", "kg", "ml", "l", "piece"]
    .map(
      (u) =>
        `<option value="${u}" ${u === sel ? "selected" : ""}>${u}</option>`,
    )
    .join("");
}
function toBaseUnit(v, u) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const s = String(u || "").toLowerCase();
  if (s === "g") return { type: "mass", value: n };
  if (s === "kg") return { type: "mass", value: n * 1000 };
  if (s === "ml") return { type: "volume", value: n };
  if (s === "l") return { type: "volume", value: n * 1000 };
  if (s === "piece") return { type: "count", value: n };
  return null;
}
function calculateEffectiveQuantity(nq, nu, pq, pu) {
  const n = toBaseUnit(nq, nu),
    p = toBaseUnit(pq, pu);
  if (!n || !p) return Number(nq) || 1;
  if (n.type !== p.type) return Number(nq) || 1;
  return Math.max(n.value / p.value, 0.01);
}
function extractPackageFromName(name) {
  const text = String(name || "").toLowerCase();
  const multiMatch = [
    ...text.matchAll(
      /(\d+(?:[.,]\d+)?)\s*[x*]\s*(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|cl|l|lt)\b/g,
    ),
  ];
  if (multiMatch.length) {
    const match = multiMatch[multiMatch.length - 1];
    const count = Number(String(match[1]).replace(",", "."));
    const amount = Number(String(match[2]).replace(",", "."));
    const unit = normalizePackageUnit(match[3]);
    if (Number.isFinite(count) && Number.isFinite(amount) && unit) {
      return { size: count * amount * packageUnitMultiplier(match[3]), unit };
    }
  }
  const singleMatch = [
    ...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|cl|l|lt)\b/g),
  ];
  if (!singleMatch.length) return null;
  const match = singleMatch[singleMatch.length - 1];
  const amount = Number(String(match[1]).replace(",", "."));
  const unit = normalizePackageUnit(match[2]);
  if (!Number.isFinite(amount) || !unit) return null;
  return { size: amount * packageUnitMultiplier(match[2]), unit };
}
function normalizePackageUnit(unit) {
  const value = String(unit || "").toLowerCase();
  if (value === "kg") return "kg";
  if (value === "gr" || value === "g") return "g";
  if (value === "ml" || value === "cl") return "ml";
  if (value === "l" || value === "lt") return "l";
  return "";
}
function packageUnitMultiplier(unit) {
  const value = String(unit || "").toLowerCase();
  if (value === "cl") return 10;
  if (value === "lt") return 1;
  return 1;
}
function estimateItemCost(price, quantity, quantityUnit, packageInfo) {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) return 0;
  const wanted = toBaseUnit(quantity, quantityUnit);
  const pack = packageInfo
    ? toBaseUnit(packageInfo.size, packageInfo.unit)
    : null;
  if (!wanted || !pack || wanted.type !== pack.type)
    return numericPrice * Math.max(Number(quantity) || 1, 0.01);
  return numericPrice * Math.max(wanted.value / pack.value, 0.01);
}
function formatTryPrice(v) {
  if (!Number.isFinite(Number(v))) return "-";
  return `${Number(v).toFixed(2)} TL`;
}

// ─── Chrome Notifications ───────────────────────────────────────────────────

let notificationsEnabled = localStorage.getItem("notif_enabled") === "true";

async function showChromeNotification(title, body, tag) {
  if (!notificationsEnabled) return false;
  if (
    isAndroidAppBridgeAvailable() &&
    typeof window.AndroidApp.showNotification === "function"
  ) {
    return Boolean(
      window.AndroidApp.showNotification(title, body, tag || "dessert-timer"),
    );
  }
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const options = {
    body: body,
    tag: tag || "dessert-timer",
    vibrate: [200, 100, 200],
    data: { url: window.location.href },
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration?.showNotification) {
        await registration.showNotification(title, options);
        return true;
      }
    }
  } catch (_) {}

  try {
    new Notification(title, options);
    return true;
  } catch (_) {}

  return false;
}

window.toggleNotifications = async function () {
  var btn = document.getElementById("notifBtn");
  if (!btn) return;
  if (!("Notification" in window)) {
    alert("Browser does not support notifications");
    return;
  }
  if (notificationsEnabled) {
    desserts.forEach((_, i) => cancelTimerPush(i).catch(() => {}));
    notificationsEnabled = false;
    localStorage.setItem("notif_enabled", "false");
    btn.classList.remove("active");
    btn.title = "Enable Notifications";
    return;
  }
  if (Notification.permission === "denied") {
    alert(
      "Notifications blocked. Click the lock icon in the address bar to allow them.",
    );
    return;
  }
  var permission = await Notification.requestPermission();
  if (permission === "granted") {
    try {
      await ensurePushSubscription();
      notificationsEnabled = true;
      localStorage.setItem("notif_enabled", "true");
      btn.classList.add("active");
      btn.title = "Disable Notifications";
      await fetch(`${SCRAPER_API_BASE}/push-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: pushToken, url: window.location.href }),
      });
      desserts.forEach((_, i) => syncTimerPush(i).catch(() => {}));
      showChromeNotification(
        "Notifications Enabled!",
        "You will receive alerts when dessert timers finish.",
        "notifications-enabled",
      );
    } catch (err) {
      notificationsEnabled = false;
      localStorage.setItem("notif_enabled", "false");
      btn.classList.remove("active");
      btn.title = "Enable Notifications";
      alert(err.message || "Push notifications are not available right now.");
    }
  }
};

window.addEventListener("android-storage-permission", (event) => {
  const granted = Boolean(event?.detail?.granted);
  if (granted) {
    localStorage.setItem("storage_permitted", "true");
  }
});

function isAndroidStoragePermissionGranted() {
  return (
    isAndroidAppBridgeAvailable() &&
    typeof window.AndroidApp.isStoragePermissionGranted === "function" &&
    window.AndroidApp.isStoragePermissionGranted()
  );
}

function requestAndroidStoragePermission() {
  if (
    isAndroidAppBridgeAvailable() &&
    typeof window.AndroidApp.requestStoragePermission === "function"
  ) {
    window.AndroidApp.requestStoragePermission();
  }
}

function androidSaveData(key, value) {
  if (
    isAndroidAppBridgeAvailable() &&
    typeof window.AndroidApp.saveData === "function"
  ) {
    window.AndroidApp.saveData(key, value);
  }
}

function androidLoadData(key) {
  if (
    isAndroidAppBridgeAvailable() &&
    typeof window.AndroidApp.loadData === "function"
  ) {
    return window.AndroidApp.loadData(key);
  }
  return null;
}

function androidRemoveData(key) {
  if (
    isAndroidAppBridgeAvailable() &&
    typeof window.AndroidApp.removeData === "function"
  ) {
    window.AndroidApp.removeData(key);
  }
}

window.addEventListener("android-notification-permission", (event) => {
  const granted = Boolean(event?.detail?.granted);
  notificationsEnabled = granted;
  localStorage.setItem("notif_enabled", granted ? "true" : "false");
  initNotifications();
  if (granted) {
    showChromeNotification(
      t("notificationsEnabledTitle"),
      t("notificationsEnabledBody"),
      "notifications-enabled",
    );
  }
});

function initNotifications() {
  var btn = document.getElementById("notifBtn");
  if (!btn) return;
  if (!("Notification" in window)) {
    btn.classList.remove("active");
    btn.title = "Browser does not support notifications";
    return;
  }
  if (notificationsEnabled && Notification.permission === "granted") {
    btn.classList.add("active");
    btn.title = "Disable Notifications";
  } else {
    btn.classList.remove("active");
    btn.title = "Enable Notifications";
  }
}

function detectServerMessageHtml() {
  return `Open <a href="http://localhost:5050" style="color:#c89b6d">http://localhost:5050</a> ${t("fromLabel")} ${t("runStartBat")}`;
}

async function detectServerPort() {
  const hostname = window.location.hostname;
  const ls = document.getElementById("loadingStatus");
  const lt = document.getElementById("loadingText");
  const rc = document.getElementById("retryCounter");

  if (window.location.protocol === "file:") {
    if (ls) {
      ls.className = "loading-status waiting";
      ls.innerHTML = detectServerMessageHtml();
    }
    if (lt) lt.textContent = t("startServerFirst");
    if (rc) rc.textContent = t("runStartBat");
    return false;
  }

  if (ls) {
    ls.className = "loading-status connecting";
    ls.textContent = t("checkingConnection");
  }

  const isCloud =
    hostname.includes("netlify") ||
    hostname.includes("onrender") ||
    (window.location.protocol === "https:" &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1");
  if (isCloud) {
    SCRAPER_API_BASE = window.location.origin;
    serverFound = true;
    return true;
  }

  const isNet = hostname !== "localhost" && hostname !== "127.0.0.1";
  if (isNet) {
    for (const port of PORTS_TO_TRY) {
      try {
        const r = await fetch(
          `${window.location.protocol}//${hostname}:${port}/health`,
          { signal: AbortSignal.timeout(2000) },
        );
        if (r.ok) {
          SCRAPER_API_BASE = `${window.location.protocol}//${hostname}:${port}`;
          serverFound = true;
          return true;
        }
      } catch (_) {}
    }
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    try {
      const r = await fetch(`${window.location.origin}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (r.ok) {
        SCRAPER_API_BASE = window.location.origin;
        serverFound = true;
        if (ls) {
          ls.className = "loading-status connected";
          ls.textContent = t("connected");
        }
        return true;
      }
    } catch (_) {}

    for (const port of PORTS_TO_TRY) {
      try {
        const r = await fetch(
          `${window.location.protocol}//localhost:${port}/health`,
          { signal: AbortSignal.timeout(2000) },
        );
        if (r.ok) {
          SCRAPER_API_BASE = `${window.location.protocol}//localhost:${port}`;
          serverFound = true;
          if (ls) {
            ls.className = "loading-status connected";
            ls.textContent = `${t("portLabel")} ${port}`;
          }
          return true;
        }
      } catch (_) {}
    }
  }

  retryCount++;
  if (ls) {
    ls.className = "loading-status waiting";
    ls.innerHTML = t("serverNotRunning").replace(
      "start.bat",
      "<b>start.bat</b>",
    );
  }
  if (lt) lt.textContent = t("serverNotFound");
  return false;
}

window.runPickSearch = async function (query) {
  if (!query) return;
  if (!SCRAPER_API_BASE) await detectServerPort();
  const quantity = Math.max(
    0.01,
    Number(document.getElementById("pickQuantityInput")?.value || "1"),
  );
  const quantityUnit =
    document.getElementById("pickQuantityUnit")?.value || "piece";
  const resultsBox = document.getElementById("pickResults");
  resultsBox.innerHTML = `<p class="pick-loading">🔍 ${t("searchingFor")} "<strong>${query}</strong>"...</p>`;
  try {
    const res = await fetch(`${SCRAPER_API_BASE}/search-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product: query }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    _pickState = {
      ..._pickState,
      query,
      results: data,
      quantity,
      quantityUnit,
    };
    renderPickResults(data, quantity, quantityUnit);
  } catch (err) {
    resultsBox.innerHTML = `<p class="pick-error">${t("errorPrefix")}: ${err.message}</p>`;
  }
};

function renderPickResults(data, quantity = 1, quantityUnit = "piece") {
  const resultsBox = document.getElementById("pickResults");
  const markets = [
    { key: "sok", label: marketLabel("sok"), color: "#e67e22" },
    { key: "migros", label: marketLabel("migros"), color: "#2980b9" },
  ];
  const selections = currentPickSelections();
  const requiredMarkets = markets
    .filter(({ key }) => Array.isArray(data[key]) && data[key].length > 0)
    .map(({ key }) => key);
  const ready =
    requiredMarkets.length > 0 &&
    requiredMarkets.every((market) => selections[market]?.name);

  let html = '<div class="pick-markets-container">';
  html += `<div class="pick-selection-banner"><div class="pick-selection-title">${t("pickChooseBoth")}</div><div class="pick-selection-status">${t("pickSelectedFrom")} ${marketLabel("sok")}: <strong>${escapeText(selections.sok?.name || t("none"))}</strong></div><div class="pick-selection-status">${t("pickSelectedFrom")} ${marketLabel("migros")}: <strong>${escapeText(selections.migros?.name || t("none"))}</strong></div><div class="${ready ? "pick-selection-ready" : "pick-selection-pending"}">${ready ? t("pickSelectionReady") : t("pickNeedOtherMarket")}</div></div>`;

  markets.forEach(({ key, label, color }) => {
    const items = data[key];
    html += `<div class="pick-market-section"><div class="pick-market-header" style="background:${color}"><span>${label} (${Array.isArray(items) ? items.length : 0})</span></div><div class="pick-market-items">`;
    if (!items || !items.length) {
      html += `<div class="pick-no-result">${t("noResultsFound")}</div>`;
    } else {
      items.forEach((item) => {
        const packageInfo = extractPackageFromName(item.name);
        const img = item.image
          ? `<img src="${item.image}" alt="" onerror="this.parentElement.innerHTML='<span>📦</span>'">`
          : "<span>📦</span>";
        const estimated = estimateItemCost(
          item.price,
          quantity,
          quantityUnit,
          packageInfo,
        );
        const packageLabel = packageInfo
          ? `${packageInfo.size} ${packageInfo.unit}`
          : t("onePiece");
        const selectedName = selections[key]?.name || "";
        const isSelected = selectedName && selectedName === item.name;
        html += `<div class="pick-product-card ${isSelected ? "selected" : ""}"><div class="pick-product-img">${img}</div><div class="pick-product-info"><div class="pick-product-name">${escapeText(item.name)}</div><div class="pick-product-price">${formatTryPrice(item.price)}</div><div class="pick-product-total">${t("estimatedCost")} (${quantity} ${escapeText(unitLabel(quantityUnit))} ${t("fromLabel")} ${escapeText(packageLabel)}): ${formatTryPrice(estimated)}</div></div><button class="pick-select-btn" data-market="${escapeAttr(key)}" data-name="${escapeAttr(item.name)}" data-pack-size="${escapeAttr(packageInfo?.size || "")}" data-pack-unit="${escapeAttr(packageInfo?.unit || "")}">${isSelected ? t("selectedState") : t("select")}</button></div>`;
      });
    }
    html += `</div></div>`;
  });

  html += `</div><div class="pick-confirm-row"><button class="pick-confirm-btn" ${ready ? "" : "disabled"} onclick="confirmPickedItems()">${t("pickSaveBoth")}</button></div>`;
  resultsBox.innerHTML = html;
  resultsBox.querySelectorAll(".pick-select-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      applyPickedItem(
        btn.dataset.market,
        btn.dataset.name,
        btn.dataset.packSize,
        btn.dataset.packUnit,
      ),
    );
  });
}

function renderMarketResult(data) {
  const resultBox = document.getElementById("marketResult");
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const totals = data.totals || {};
  const cheapest = data.cheapestMarket || "N/A";
  const cheapestTotal = Number(data.cheapestTotal || 0);

  let html = `<table class="market-table"><thead><tr><th>${t("ingredient")}</th><th>${t("qty")}</th><th>${marketLabel("sok")} ${t("chosenItem")}</th><th>${marketLabel("sok")} ${t("unit")}</th><th>${marketLabel("sok")} ${t("cost")}</th><th>${marketLabel("migros")} ${t("chosenItem")}</th><th>${marketLabel("migros")} ${t("unit")}</th><th>${marketLabel("migros")} ${t("cost")}</th></tr></thead><tbody>`;
  rows.forEach((r) => {
    html += `<tr><td>${escapeText(r.ingredient)}</td><td>${escapeText(r.quantity)}</td><td>${escapeText(r.sok?.name || r.marketNames?.sok || t("unavailable"))}</td><td>${formatTryPrice(r.sok?.unitPrice)}</td><td>${formatTryPrice(r.sok?.cost)}</td><td>${escapeText(r.migros?.name || r.marketNames?.migros || t("unavailable"))}</td><td>${formatTryPrice(r.migros?.unitPrice)}</td><td>${formatTryPrice(r.migros?.cost)}</td></tr>`;
  });
  html += `</tbody></table><p><strong>${t("totalSok")}:</strong> ${formatTryPrice(totals.sok)}</p><p><strong>${t("totalMigros")}:</strong> ${formatTryPrice(totals.migros)}</p><p class="best-market">${t("cheapestMarket")}: ${marketLabel(cheapest)} (${formatTryPrice(cheapestTotal)})</p>`;
  resultBox.innerHTML = html;
}

function normalizeText(value) {
  if (!value) return "";
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function renderUnitOptions(sel) {
  return ["g", "kg", "ml", "l", "piece"]
    .map(
      (u) =>
        `<option value="${u}" ${u === sel ? "selected" : ""}>${escapeText(u)}</option>`,
    )
    .join("");
}

window.saveIngredient = function (di, ii) {
  const nameEl = document.getElementById(`ing_name_${di}_${ii}`);
  const descEl = document.getElementById(`ing_desc_${di}_${ii}`);
  const qtyEl = document.getElementById(`ing_qty_${di}_${ii}`);
  const unitEl = document.getElementById(`ing_unit_${di}_${ii}`);
  const packEl = document.getElementById(`ing_pack_${di}_${ii}`);
  const packUnitEl = document.getElementById(`ing_pack_unit_${di}_${ii}`);
  const sokPriceEl = document.getElementById(`ing_price_sok_${di}_${ii}`);
  const migrosPriceEl = document.getElementById(`ing_price_migros_${di}_${ii}`);
  if (!nameEl || !qtyEl || !unitEl || !packEl || !packUnitEl) {
    alert(t("reopenSettings"));
    return;
  }
  const name = (nameEl.value || "").trim();
  const description = (descEl?.value || "").trim();
  const quantity = parseFloat(qtyEl.value || "0");
  const unit = unitEl.value || "piece";
  const packageSize = parseFloat(packEl.value || "0");
  const packageUnit = packUnitEl.value || "piece";
  const readOptionalPrice = (el) => {
    const raw = String(el?.value || "").trim();
    if (!raw) return null;
    const numeric = Number(raw);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
  };
  if (!name) return alert(t("ingredientNameRequired"));
  if (!Number.isFinite(quantity) || quantity <= 0)
    return alert(t("quantityMustBeGreater"));
  if (!Number.isFinite(packageSize) || packageSize <= 0)
    return alert(t("packageSizeMustBeGreater"));
  const existing = normalizeIngredient(desserts[di].ingredients[ii]);
  const identityChanged =
    normalizeText(existing.name) !== normalizeText(name) ||
    normalizeText(existing.description) !== normalizeText(description) ||
    Number(existing.packageSize) !== Number(packageSize) ||
    String(existing.packageUnit) !== String(packageUnit);
  const marketSelections = identityChanged
    ? emptyMarketSelections()
    : existing.marketSelections;
  const nextPrices = {
    sok: readOptionalPrice(sokPriceEl),
    migros: readOptionalPrice(migrosPriceEl),
  };
  marketKeys().forEach((market) => {
    const currentSelection = marketSelections?.[market];
    const nextPrice = nextPrices[market];
    if (currentSelection) {
      marketSelections[market] = {
        ...currentSelection,
        price: nextPrice,
      };
      return;
    }
    if (nextPrice !== null) {
      marketSelections[market] = {
        market,
        name: "",
        price: nextPrice,
        packageSize,
        packageUnit,
      };
    }
  });
  desserts[di].ingredients[ii] = {
    name,
    description,
    quantity,
    unit,
    packageSize,
    packageUnit,
    marketSelections,
  };
  saveLocal();
  alert(t("ingredientSaved"));
  renderSettings();
  renderDessertSelect();
};

window.toggleNotifications = async function () {
  const btn = document.getElementById("notifBtn");
  if (!btn) return;
  if (isAndroidAppBridgeAvailable()) {
    if (hasAndroidNotificationPermission()) {
      notificationsEnabled = !notificationsEnabled;
      localStorage.setItem(
        "notif_enabled",
        notificationsEnabled ? "true" : "false",
      );
      initNotifications();
      if (notificationsEnabled) {
        showChromeNotification(
          t("notificationsEnabledTitle"),
          t("notificationsEnabledBody"),
          "notifications-enabled",
        );
      }
      return;
    }

    if (typeof window.AndroidApp.requestNotificationPermission === "function") {
      window.AndroidApp.requestNotificationPermission();
    }
    return;
  }
  if (!("Notification" in window)) {
    alert(t("browserNoNotifications"));
    return;
  }
  if (notificationsEnabled) {
    desserts.forEach((_, i) => cancelTimerPush(i).catch(() => {}));
    notificationsEnabled = false;
    localStorage.setItem("notif_enabled", "false");
    btn.classList.remove("active");
    btn.title = t("enableNotifications");
    return;
  }
  if (Notification.permission === "denied") {
    alert(t("notificationsBlocked"));
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    try {
      await ensurePushSubscription();
      notificationsEnabled = true;
      localStorage.setItem("notif_enabled", "true");
      btn.classList.add("active");
      btn.title = t("disableNotifications");
      await fetch(`${SCRAPER_API_BASE}/push-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: pushToken, url: window.location.href }),
      });
      desserts.forEach((_, i) => syncTimerPush(i).catch(() => {}));
      showChromeNotification(
        t("notificationsEnabledTitle"),
        t("notificationsEnabledBody"),
        "notifications-enabled",
      );
    } catch (err) {
      notificationsEnabled = false;
      localStorage.setItem("notif_enabled", "false");
      btn.classList.remove("active");
      btn.title = t("enableNotifications");
      alert(err.message || t("pushUnavailableNow"));
    }
  }
};

function initNotifications() {
  const btn = document.getElementById("notifBtn");
  if (!btn) return;
  if (isAndroidAppBridgeAvailable()) {
    const enabled = notificationsEnabled && hasAndroidNotificationPermission();
    btn.classList.toggle("active", enabled);
    btn.title = enabled ? t("disableNotifications") : t("enableNotifications");
    return;
  }
  if (!("Notification" in window)) {
    btn.classList.remove("active");
    btn.title = t("browserNoNotifications");
    return;
  }
  if (notificationsEnabled && Notification.permission === "granted") {
    btn.classList.add("active");
    btn.title = t("disableNotifications");
  } else {
    btn.classList.remove("active");
    btn.title = t("enableNotifications");
  }
}

const MARKET_DEFS = [
  {
    key: "sok",
    label: "Sok",
    color: "#e67e22",
    url: (query) =>
      `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(query)}`,
  },
];

function marketKeys() {
  return MARKET_DEFS.map((market) => market.key);
}

function emptyMarketSelections() {
  return Object.fromEntries(marketKeys().map((key) => [key, null]));
}

function marketLabel(market) {
  const match = MARKET_DEFS.find(
    (entry) => entry.key === String(market || "").toLowerCase(),
  );
  return match ? match.label : market || t("unavailable");
}

function normalizeIngredient(ing) {
  const marketSelections =
    ing?.marketSelections && typeof ing.marketSelections === "object"
      ? ing.marketSelections
      : {};
  const normalizedSelections = emptyMarketSelections();

  marketKeys().forEach((market) => {
    if (!marketSelections[market]) return;
    normalizedSelections[market] = {
      market,
      name: String(marketSelections[market].name || ""),
      price: Number.isFinite(Number(marketSelections[market].price))
        ? Number(marketSelections[market].price)
        : null,
      packageSize: Number.isFinite(Number(marketSelections[market].packageSize))
        ? Number(marketSelections[market].packageSize)
        : null,
      packageUnit: String(marketSelections[market].packageUnit || ""),
    };
  });

  return {
    name: String(ing?.name || ""),
    quantity: Number.isFinite(Number(ing?.quantity)) ? Number(ing.quantity) : 1,
    unit: String(ing?.unit || "piece"),
    description: String(ing?.description || ""),
    packageSize: Number.isFinite(Number(ing?.packageSize))
      ? Number(ing.packageSize)
      : 1,
    packageUnit: String(ing?.packageUnit || "piece"),
    marketSelections: normalizedSelections,
  };
}

function currentPickSelections() {
  return _pickState?.draftSelections || emptyMarketSelections();
}

window.openPickModal = async function (dessertIndex, ingredientIndex) {
  _pickTarget = { dessertIndex, ingredientIndex };
  const nameEl = document.getElementById(
    `ing_name_${dessertIndex}_${ingredientIndex}`,
  );
  const descEl = document.getElementById(
    `ing_desc_${dessertIndex}_${ingredientIndex}`,
  );
  const unitEl = document.getElementById(
    `ing_unit_${dessertIndex}_${ingredientIndex}`,
  );
  const qtyEl = document.getElementById(
    `ing_qty_${dessertIndex}_${ingredientIndex}`,
  );
  const ing = normalizeIngredient(
    desserts[dessertIndex]?.ingredients?.[ingredientIndex],
  );
  const modal = document.getElementById("pickModal");
  const searchInput = document.getElementById("pickSearchInput");
  const qtyInput = document.getElementById("pickQuantityInput");
  const qtyUnit = document.getElementById("pickQuantityUnit");
  const resultsBox = document.getElementById("pickResults");
  const searchQuery =
    buildIngredientSearchQuery(nameEl?.value, descEl?.value) ||
    buildIngredientSearchQuery(ing.name, ing.description);

  const draftSelections = emptyMarketSelections();
  marketKeys().forEach((market) => {
    draftSelections[market] = ing.marketSelections?.[market]
      ? { ...ing.marketSelections[market] }
      : null;
  });

  _pickState = {
    query: searchQuery,
    results: null,
    quantity: Number(qtyEl?.value || "1") || 1,
    quantityUnit: unitEl?.value || "piece",
    draftSelections,
  };

  searchInput.value = searchQuery;
  resultsBox.innerHTML = "";
  modal.classList.remove("hidden");
  if (qtyInput) qtyInput.value = qtyEl?.value || "1";
  if (qtyUnit) qtyUnit.value = unitEl?.value || "piece";
  if (searchInput.value) await runPickSearch(searchInput.value);
};

window.closePickModal = function () {
  document.getElementById("pickModal").classList.add("hidden");
  _pickTarget = null;
  _pickState = {
    query: "",
    results: null,
    quantity: 1,
    quantityUnit: "piece",
    draftSelections: emptyMarketSelections(),
  };
};

window.applyPickedItem = function (
  market,
  name,
  price,
  packageSize,
  packageUnit,
) {
  if (!_pickTarget) return;
  _pickState.draftSelections[market] = {
    market,
    name,
    price: Number.isFinite(Number(price)) ? Number(price) : null,
    packageSize: packageSize ? Number(packageSize) : null,
    packageUnit: packageUnit || "",
  };
  if (_pickState.results) {
    renderPickResults(
      _pickState.results,
      _pickState.quantity,
      _pickState.quantityUnit,
    );
  }
};

window.confirmPickedItems = function () {
  if (!_pickTarget || !_pickState.results) return;
  if (
    Array.isArray(_pickState.results.sok) &&
    _pickState.results.sok.length > 0 &&
    !_pickState.draftSelections.sok?.name
  ) {
    alert(t("pickNeedOtherMarket"));
    return;
  }

  const el = document.getElementById(
    `ing_name_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const descEl = document.getElementById(
    `ing_desc_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const qtyEl = document.getElementById(
    `ing_qty_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const unitEl = document.getElementById(
    `ing_unit_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const packEl = document.getElementById(
    `ing_pack_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const packUnitEl = document.getElementById(
    `ing_pack_unit_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const qtyInput = document.getElementById("pickQuantityInput");
  const qtyUnit = document.getElementById("pickQuantityUnit");
  const ing = normalizeIngredient(
    desserts[_pickTarget.dessertIndex]?.ingredients?.[
      _pickTarget.ingredientIndex
    ],
  );
  const firstPicked = _pickState.draftSelections.sok?.name || "";
  const nextName = (el?.value || "").trim() || _pickState.query || firstPicked;
  const nextDescription = (descEl?.value || "").trim();
  const nextQuantity = Math.max(
    0.01,
    Number(qtyInput?.value || qtyEl?.value || ing.quantity || 1),
  );
  const nextUnit = qtyUnit?.value || unitEl?.value || ing.unit || "piece";
  const packSource = _pickState.draftSelections.sok;
  const nextPackageSize =
    Number(packSource?.packageSize || packEl?.value || ing.packageSize || 1) ||
    1;
  const nextPackageUnit =
    packSource?.packageUnit || packUnitEl?.value || ing.packageUnit || "piece";

  const marketSelections = emptyMarketSelections();
  marketKeys().forEach((market) => {
    marketSelections[market] = _pickState.draftSelections[market]
      ? { ..._pickState.draftSelections[market] }
      : null;
  });

  const nextIngredient = {
    ...ing,
    name: nextName,
    description: nextDescription,
    quantity: nextQuantity,
    unit: nextUnit,
    packageSize: nextPackageSize,
    packageUnit: nextPackageUnit,
    marketSelections,
  };
  desserts[_pickTarget.dessertIndex].ingredients[_pickTarget.ingredientIndex] =
    nextIngredient;

  if (el) el.value = nextName;
  if (descEl) descEl.value = nextDescription;
  if (qtyEl) qtyEl.value = String(nextQuantity);
  if (unitEl) unitEl.value = nextUnit;
  if (packEl) packEl.value = String(nextPackageSize);
  if (packUnitEl) packUnitEl.value = nextPackageUnit;

  saveLocal();
  renderSettings();
  renderDessertSelect();
  closePickModal();
};

function renderPickResults(data, quantity = 1, quantityUnit = "piece") {
  const resultsBox = document.getElementById("pickResults");
  const selections = currentPickSelections();
  const markets = MARKET_DEFS.filter(({ key }) => Array.isArray(data[key]));
  const ready =
    !Array.isArray(data.sok) ||
    data.sok.length === 0 ||
    Boolean(selections.sok?.name);

  let html = '<div class="pick-markets-container">';
  html += `<div class="pick-selection-banner"><div class="pick-selection-title">${t("pickItemFromMarket")}</div>`;
  MARKET_DEFS.forEach(({ key }) => {
    html += `<div class="pick-selection-status">${t("pickSelectedFrom")} ${marketLabel(key)}: <strong>${escapeText(selections[key]?.name || t("none"))}</strong></div>`;
  });
  html += `</div>`;

  markets.forEach(({ key, label, color }) => {
    const items = data[key];
    html += `<div class="pick-market-section"><div class="pick-market-header" style="background:${color}"><span>${label} (${Array.isArray(items) ? items.length : 0})</span></div><div class="pick-market-items">`;
    if (!items || !items.length) {
      html += `<div class="pick-no-result">${t("noResultsFound")}</div>`;
    } else {
      items.forEach((item) => {
        const packageInfo = extractPackageFromName(item.name);
        const img = item.image
          ? `<img src="${item.image}" alt="" onerror="this.parentElement.innerHTML='<span>📦</span>'">`
          : "<span>📦</span>";
        const estimated = estimateItemCost(
          item.price,
          quantity,
          quantityUnit,
          packageInfo,
        );
        const packageLabel = packageInfo
          ? `${packageInfo.size} ${packageInfo.unit}`
          : t("onePiece");
        const selectedName = selections[key]?.name || "";
        const isSelected = selectedName && selectedName === item.name;
        html += `<div class="pick-product-card ${isSelected ? "selected" : ""}"><div class="pick-product-img">${img}</div><div class="pick-product-info"><div class="pick-product-name">${escapeText(item.name)}</div><div class="pick-product-price">${formatTryPrice(item.price)}</div><div class="pick-product-total">${t("estimatedCost")} (${quantity} ${escapeText(unitLabel(quantityUnit))} ${t("fromLabel")} ${escapeText(packageLabel)}): ${formatTryPrice(estimated)}</div></div><button class="pick-select-btn" data-market="${escapeAttr(key)}" data-name="${escapeAttr(item.name)}" data-pack-size="${escapeAttr(packageInfo?.size || "")}" data-pack-unit="${escapeAttr(packageInfo?.unit || "")}">${isSelected ? t("selectedState") : t("select")}</button></div>`;
      });
    }
    html += `</div></div>`;
  });

  html += `</div><div class="pick-confirm-row"><button class="pick-confirm-btn" ${ready ? "" : "disabled"} onclick="confirmPickedItems()">${t("saveBtn")}</button></div>`;
  resultsBox.innerHTML = html;
  resultsBox.querySelectorAll(".pick-select-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      applyPickedItem(
        btn.dataset.market,
        btn.dataset.name,
        btn.dataset.packSize,
        btn.dataset.packUnit,
      ),
    );
  });
}

function renderIngredientsSettings() {
  const panel = document.getElementById("ingredientsSettings");
  panel.innerHTML = "";
  desserts.forEach((dessert, di) => {
    const wrapper = document.createElement("div");
    wrapper.className = "panel";
    wrapper.innerHTML = `<div class="ing-header"><h3>${dessert.name}</h3><div class="ing-header-btns"><button onclick="addIngredient(${di})">${t("addIngredientBtn")}</button></div></div><div id="ingredients_${di}" class="ingredients-list"></div>`;
    panel.appendChild(wrapper);
    const list = wrapper.querySelector(`#ingredients_${di}`);
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

    ingredients.forEach((ingredient, ii) => {
      const normalized = normalizeIngredient(ingredient);
      const summary = MARKET_DEFS.map(({ key }) =>
        normalized.marketSelections?.[key]?.name
          ? `<span>${marketLabel(key)}: ${escapeText(normalized.marketSelections[key].name)}</span>`
          : "",
      )
        .filter(Boolean)
        .join("");
      const pickedSummary = summary
        ? `<div class="picked-market-summary">${summary}</div>`
        : "";
      const row = document.createElement("div");
      row.className = "ingredient-row";
      row.innerHTML = `<input type="text" id="ing_name_${di}_${ii}" placeholder="${t("ingredientName")}" value="${normalized.name}"><input type="text" id="ing_desc_${di}_${ii}" placeholder="${t("description")}" value="${normalized.description}"><input type="number" step="0.01" min="0.01" id="ing_qty_${di}_${ii}" placeholder="${t("need")}" value="${normalized.quantity}"><select id="ing_unit_${di}_${ii}">${renderUnitOptions(normalized.unit)}</select><span>${t("perPackage")}</span><input type="number" step="0.01" min="0.01" id="ing_pack_${di}_${ii}" placeholder="${t("packSize")}" value="${normalized.packageSize}"><select id="ing_pack_unit_${di}_${ii}">${renderUnitOptions(normalized.packageUnit)}</select><button class="btn-pick" onclick="openPickModal(${di},${ii})">${t("pickFromMarket")}</button><button onclick="saveIngredient(${di},${ii})">${t("saveBtn")}</button><button onclick="openMarketLink('sok',${di},${ii})">Open Sok</button><button class="btn-delete" onclick="removeIngredient(${di},${ii})">${t("deleteBtn")}</button>${pickedSummary}`;
      list.appendChild(row);
    });
  });
}

window.findCheapestForSelectedDessert = async function () {
  if (!SCRAPER_API_BASE) await detectServerPort();
  const select = document.getElementById("dessertSelect");
  const resultBox = document.getElementById("marketResult");
  const idx = Number(select?.value ?? -1);
  const dessert = desserts[idx];
  if (!dessert) return (resultBox.innerHTML = `<p>${t("selectDessert")}</p>`);

  const ingredients = (dessert.ingredients || [])
    .map((raw) => {
      const ing = normalizeIngredient(raw);
      const baseName = [ing.name, ing.description]
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        name: baseName,
        marketNames: {
          sok: ing.marketSelections?.sok?.name || baseName,
        },
        quantity: calculateEffectiveQuantity(
          ing.quantity,
          ing.unit,
          ing.packageSize,
          ing.packageUnit,
        ),
        displayQuantity: `${ing.quantity} ${ing.unit} (pack ${ing.packageSize} ${ing.packageUnit})`,
      };
    })
    .filter((ing) => ing.name && ing.quantity > 0);

  if (!ingredients.length) {
    resultBox.innerHTML = `<p>${t("addIngredientsFirst")}</p>`;
    return;
  }

  resultBox.innerHTML = `<p>${t("searching")}</p>`;
  try {
    const res = await fetch(`${SCRAPER_API_BASE}/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredients }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    recordMonthlyReport(dessert.name, data);
    renderMarketResult(data);
    renderMonthlyReport();
  } catch (err) {
    resultBox.innerHTML = `<p>${t("marketServiceError")}: ${err.message}</p>`;
  }
};

function renderMarketResult(data) {
  const resultBox = document.getElementById("marketResult");
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const totals = data.totals || {};
  const cheapest = data.cheapestMarket || "N/A";
  const cheapestTotal = Number(data.cheapestTotal || 0);

  let html = `<table class="market-table"><thead><tr><th>${t("ingredient")}</th><th>${t("qty")}</th><th>${marketLabel("sok")} ${t("chosenItem")}</th><th>${marketLabel("sok")} ${t("unit")}</th><th>${marketLabel("sok")} ${t("cost")}</th></tr></thead><tbody>`;

  rows.forEach((row) => {
    html += `<tr><td>${escapeText(row.ingredient)}</td><td>${escapeText(row.quantity)}</td><td>${escapeText(row.sok?.name || row.marketNames?.sok || t("unavailable"))}</td><td>${formatTryPrice(row.sok?.unitPrice)}</td><td>${formatTryPrice(row.sok?.cost)}</td></tr>`;
  });

  html += `</tbody></table>`;
  html += `<p><strong>Total ${marketLabel("sok")}:</strong> ${formatTryPrice(totals.sok)}</p>`;
  html += `<p class="best-market">${t("cheapestMarket")}: ${escapeText(marketLabel(cheapest))} (${formatTryPrice(cheapestTotal)})</p>`;
  resultBox.innerHTML = html;
}

window.openMarketLink = function (market, di, ii) {
  const nameEl = document.getElementById(`ing_name_${di}_${ii}`);
  const descEl = document.getElementById(`ing_desc_${di}_${ii}`);
  const query = buildIngredientSearchQuery(nameEl?.value, descEl?.value);
  if (!query) {
    alert(t("writeIngredientFirst"));
    return;
  }
  const config = MARKET_DEFS.find((entry) => entry.key === market);
  if (!config) return;
  window.open(config.url(query), "_blank");
};

const MARKET_DEFS_V2 = [
  {
    key: "sok",
    label: "Sok",
    color: "#f97316",
    url: (query) =>
      `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(query)}`,
  },
  {
    key: "migros",
    label: "Migros",
    color: "#0f766e",
    url: (query) =>
      `https://www.migros.com.tr/arama?q=${encodeURIComponent(query)}`,
  },
];

function marketKeys() {
  return MARKET_DEFS_V2.map((market) => market.key);
}

function emptyMarketSelections() {
  return Object.fromEntries(marketKeys().map((key) => [key, null]));
}

function marketLabel(market) {
  const match = MARKET_DEFS_V2.find(
    (entry) => entry.key === String(market || "").toLowerCase(),
  );
  return match ? match.label : market || t("unavailable");
}

function normalizeIngredient(ing) {
  const marketSelections =
    ing?.marketSelections && typeof ing.marketSelections === "object"
      ? ing.marketSelections
      : {};
  const normalizedSelections = emptyMarketSelections();

  marketKeys().forEach((market) => {
    if (!marketSelections[market]) return;
    normalizedSelections[market] = {
      market,
      name: String(marketSelections[market].name || ""),
      price: Number.isFinite(Number(marketSelections[market].price))
        ? Number(marketSelections[market].price)
        : null,
      packageSize: Number.isFinite(Number(marketSelections[market].packageSize))
        ? Number(marketSelections[market].packageSize)
        : null,
      packageUnit: String(marketSelections[market].packageUnit || ""),
    };
  });

  let normalizedPackageSize = Number.isFinite(Number(ing?.packageSize))
    ? Number(ing.packageSize)
    : 1;
  let normalizedPackageUnit = String(ing?.packageUnit || "piece");
  const repairSource = marketKeys()
    .map((market) => normalizedSelections[market])
    .find(
      (selection) =>
        selection &&
        Number.isFinite(Number(selection.packageSize)) &&
        selection.packageUnit &&
        Number.isFinite(Number(selection.price)) &&
        Math.abs(normalizedPackageSize - Number(selection.price)) < 0.0001,
    );

  if (repairSource) {
    normalizedPackageSize = Number(repairSource.packageSize);
    normalizedPackageUnit = String(
      repairSource.packageUnit || normalizedPackageUnit,
    );
  }

  return {
    name: String(ing?.name || ""),
    quantity: Number.isFinite(Number(ing?.quantity)) ? Number(ing.quantity) : 1,
    unit: String(ing?.unit || "piece"),
    description: String(ing?.description || ""),
    packageSize: normalizedPackageSize,
    packageUnit: normalizedPackageUnit,
    marketSelections: normalizedSelections,
  };
}

function currentPickSelections() {
  return _pickState?.draftSelections || emptyMarketSelections();
}

window.openPickModal = async function (dessertIndex, ingredientIndex) {
  _pickTarget = { dessertIndex, ingredientIndex };
  const nameEl = document.getElementById(
    `ing_name_${dessertIndex}_${ingredientIndex}`,
  );
  const descEl = document.getElementById(
    `ing_desc_${dessertIndex}_${ingredientIndex}`,
  );
  const unitEl = document.getElementById(
    `ing_unit_${dessertIndex}_${ingredientIndex}`,
  );
  const qtyEl = document.getElementById(
    `ing_qty_${dessertIndex}_${ingredientIndex}`,
  );
  const ing = normalizeIngredient(
    desserts[dessertIndex]?.ingredients?.[ingredientIndex],
  );
  const modal = document.getElementById("pickModal");
  const searchInput = document.getElementById("pickSearchInput");
  const qtyInput = document.getElementById("pickQuantityInput");
  const qtyUnit = document.getElementById("pickQuantityUnit");
  const resultsBox = document.getElementById("pickResults");
  const searchQuery =
    buildIngredientSearchQuery(nameEl?.value, descEl?.value) ||
    buildIngredientSearchQuery(ing.name, ing.description);

  const draftSelections = emptyMarketSelections();
  marketKeys().forEach((market) => {
    draftSelections[market] = ing.marketSelections?.[market]
      ? { ...ing.marketSelections[market] }
      : null;
  });

  _pickState = {
    query: searchQuery,
    results: null,
    quantity: Number(qtyEl?.value || "1") || 1,
    quantityUnit: unitEl?.value || "piece",
    draftSelections,
  };

  searchInput.value = searchQuery;
  resultsBox.innerHTML = "";
  modal.classList.remove("hidden");
  if (qtyInput) qtyInput.value = qtyEl?.value || "1";
  if (qtyUnit) qtyUnit.value = unitEl?.value || "piece";
  if (searchInput.value) await runPickSearch(searchInput.value);
};

window.closePickModal = function () {
  document.getElementById("pickModal").classList.add("hidden");
  _pickTarget = null;
  _pickState = {
    query: "",
    results: null,
    quantity: 1,
    quantityUnit: "piece",
    draftSelections: emptyMarketSelections(),
  };
};

window.applyPickedItem = function (
  market,
  name,
  price,
  packageSize,
  packageUnit,
) {
  if (!_pickTarget) return;
  _pickState.draftSelections[market] = {
    market,
    name,
    price: Number.isFinite(Number(price)) ? Number(price) : null,
    packageSize: packageSize ? Number(packageSize) : null,
    packageUnit: packageUnit || "",
  };
  if (_pickState.results) {
    renderPickResults(
      _pickState.results,
      _pickState.quantity,
      _pickState.quantityUnit,
    );
  }
};

window.confirmPickedItems = function () {
  if (!_pickTarget || !_pickState.results) return;
  const requiredMarkets = marketKeys().filter(
    (market) =>
      Array.isArray(_pickState.results[market]) &&
      _pickState.results[market].length > 0,
  );
  if (
    !requiredMarkets.every((market) => _pickState.draftSelections[market]?.name)
  ) {
    alert(t("pickNeedOtherMarket"));
    return;
  }

  const el = document.getElementById(
    `ing_name_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const descEl = document.getElementById(
    `ing_desc_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const qtyEl = document.getElementById(
    `ing_qty_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const unitEl = document.getElementById(
    `ing_unit_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const packEl = document.getElementById(
    `ing_pack_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const packUnitEl = document.getElementById(
    `ing_pack_unit_${_pickTarget.dessertIndex}_${_pickTarget.ingredientIndex}`,
  );
  const qtyInput = document.getElementById("pickQuantityInput");
  const qtyUnit = document.getElementById("pickQuantityUnit");
  const ing = normalizeIngredient(
    desserts[_pickTarget.dessertIndex]?.ingredients?.[
      _pickTarget.ingredientIndex
    ],
  );
  const firstPicked =
    marketKeys()
      .map((market) => _pickState.draftSelections[market]?.name)
      .find(Boolean) || "";
  const nextName = (el?.value || "").trim() || _pickState.query || firstPicked;
  const nextDescription = (descEl?.value || "").trim();
  const nextQuantity = Math.max(
    0.01,
    Number(qtyInput?.value || qtyEl?.value || ing.quantity || 1),
  );
  const nextUnit = qtyUnit?.value || unitEl?.value || ing.unit || "piece";
  const packSource = marketKeys()
    .map((market) => _pickState.draftSelections[market])
    .find(Boolean);
  const nextPackageSize =
    Number(packSource?.packageSize || packEl?.value || ing.packageSize || 1) ||
    1;
  const nextPackageUnit =
    packSource?.packageUnit || packUnitEl?.value || ing.packageUnit || "piece";

  const marketSelections = emptyMarketSelections();
  marketKeys().forEach((market) => {
    marketSelections[market] = _pickState.draftSelections[market]
      ? { ..._pickState.draftSelections[market] }
      : null;
  });

  desserts[_pickTarget.dessertIndex].ingredients[_pickTarget.ingredientIndex] =
    {
      ...ing,
      name: nextName,
      description: nextDescription,
      quantity: nextQuantity,
      unit: nextUnit,
      packageSize: nextPackageSize,
      packageUnit: nextPackageUnit,
      marketSelections,
    };

  if (el) el.value = nextName;
  if (descEl) descEl.value = nextDescription;
  if (qtyEl) qtyEl.value = String(nextQuantity);
  if (unitEl) unitEl.value = nextUnit;
  if (packEl) packEl.value = String(nextPackageSize);
  if (packUnitEl) packUnitEl.value = nextPackageUnit;

  saveLocal();
  renderSettings();
  renderDessertSelect();
  closePickModal();
};

function renderPickResults(data, quantity = 1, quantityUnit = "piece") {
  const resultsBox = document.getElementById("pickResults");
  const selections = currentPickSelections();
  const markets = MARKET_DEFS_V2.filter(({ key }) => Array.isArray(data[key]));
  const requiredMarkets = markets
    .filter(({ key }) => data[key].length > 0)
    .map(({ key }) => key);
  const ready =
    requiredMarkets.length > 0 &&
    requiredMarkets.every((market) => selections[market]?.name);

  let html = '<div class="pick-markets-container">';
  html += `<div class="pick-selection-banner"><div class="pick-selection-title">${t("pickChooseBoth")}</div>`;
  MARKET_DEFS_V2.forEach(({ key }) => {
    const selectedLabel = selections[key]?.name
      ? `${escapeText(selections[key].name)}${selections[key].price !== null && selections[key].price !== undefined ? ` (${formatTryPrice(selections[key].price)})` : ""}`
      : escapeText(t("none"));
    html += `<div class="pick-selection-status">${t("pickSelectedFrom")} ${marketLabel(key)}: <strong>${selectedLabel}</strong></div>`;
  });
  html += `<div class="${ready ? "pick-selection-ready" : "pick-selection-pending"}">${ready ? t("pickSelectionReady") : t("pickNeedOtherMarket")}</div></div>`;

  markets.forEach(({ key, label, color }) => {
    const items = data[key];
    html += `<section class="pick-market-section"><div class="pick-market-header" style="background:${color}"><span>${label} (${Array.isArray(items) ? items.length : 0})</span></div><div class="pick-market-items">`;
    if (!items || !items.length) {
      html += `<div class="pick-no-result">${t("noResultsFound")}</div>`;
    } else {
      items.forEach((item) => {
        const packageInfo = extractPackageFromName(item.name);
        const img = item.image
          ? `<img src="${item.image}" alt="" onerror="this.parentElement.innerHTML='<span>📦</span>'">`
          : "<span>📦</span>";
        const estimated = estimateItemCost(
          item.price,
          quantity,
          quantityUnit,
          packageInfo,
        );
        const packageLabel = packageInfo
          ? `${packageInfo.size} ${packageInfo.unit}`
          : t("onePiece");
        const selectedName = selections[key]?.name || "";
        const isSelected = selectedName && selectedName === item.name;
        html += `<article class="pick-product-card ${isSelected ? "selected" : ""}"><div class="pick-product-img">${img}</div><div class="pick-product-info"><div class="pick-product-name">${escapeText(item.name)}</div><div class="pick-product-price">${formatTryPrice(item.price)}</div><div class="pick-product-total">${t("estimatedCost")} (${quantity} ${escapeText(unitLabel(quantityUnit))} ${t("fromLabel")} ${escapeText(packageLabel)}): ${formatTryPrice(estimated)}</div></div><button class="pick-select-btn" data-market="${escapeAttr(key)}" data-name="${escapeAttr(item.name)}" data-price="${escapeAttr(estimated)}" data-pack-size="${escapeAttr(packageInfo?.size || "")}" data-pack-unit="${escapeAttr(packageInfo?.unit || "")}">${isSelected ? t("selectedState") : t("select")}</button></article>`;
      });
    }
    html += `</div></section>`;
  });

  html += `</div><div class="pick-confirm-row"><button class="pick-confirm-btn" ${ready ? "" : "disabled"} onclick="confirmPickedItems()">${t("pickSaveBoth")}</button></div>`;
  resultsBox.innerHTML = html;
  resultsBox.querySelectorAll(".pick-select-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      applyPickedItem(
        btn.dataset.market,
        btn.dataset.name,
        btn.dataset.price,
        btn.dataset.packSize,
        btn.dataset.packUnit,
      ),
    );
  });
}

function renderIngredientsSettings() {
  const panel = document.getElementById("ingredientsSettings");
  panel.innerHTML = "";
  desserts.forEach((dessert, di) => {
    const wrapper = document.createElement("div");
    wrapper.className = "panel";
    wrapper.innerHTML = `<div class="ing-header"><h3>${dessert.name}</h3><div class="ing-header-btns"><button onclick="addIngredient(${di})">${t("addIngredientBtn")}</button></div></div><div id="ingredients_${di}" class="ingredients-list"></div>`;
    panel.appendChild(wrapper);
    const list = wrapper.querySelector(`#ingredients_${di}`);
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

    ingredients.forEach((ingredient, ii) => {
      const normalized = normalizeIngredient(ingredient);
      const sokManualPrice = normalized.marketSelections?.sok?.price;
      const migrosManualPrice = normalized.marketSelections?.migros?.price;
      const summary = MARKET_DEFS_V2.map(({ key }) =>
        normalized.marketSelections?.[key]?.name
          ? `<span>${marketLabel(key)}: ${escapeText(normalized.marketSelections[key].name)}${normalized.marketSelections[key].price !== null && normalized.marketSelections[key].price !== undefined ? ` • ${formatTryPrice(normalized.marketSelections[key].price)}` : ""}</span>`
          : "",
      )
        .filter(Boolean)
        .join("");
      const pickedSummary = summary
        ? `<div class="picked-market-summary">${summary}</div>`
        : "";
      const marketButtons = MARKET_DEFS_V2.map(
        ({ key, label }) =>
          `<button onclick="openMarketLink('${key}',${di},${ii})">Open ${label}</button>`,
      ).join("");

      const row = document.createElement("div");
      row.className = "ingredient-row";
      row.innerHTML = `<input type="text" id="ing_name_${di}_${ii}" placeholder="${t("ingredientName")}" value="${normalized.name}"><input type="text" id="ing_desc_${di}_${ii}" placeholder="${t("description")}" value="${normalized.description}"><input type="number" step="0.01" min="0.01" id="ing_qty_${di}_${ii}" placeholder="${t("need")}" value="${normalized.quantity}"><select id="ing_unit_${di}_${ii}">${renderUnitOptions(normalized.unit)}</select><span>${t("perPackage")}</span><input type="number" step="0.01" min="0.01" id="ing_pack_${di}_${ii}" placeholder="${t("packSize")}" value="${normalized.packageSize}"><select id="ing_pack_unit_${di}_${ii}">${renderUnitOptions(normalized.packageUnit)}</select><label class="market-price-field"><span>${marketLabel("sok")} ${t("cost")}</span><input type="number" step="0.01" min="0" id="ing_price_sok_${di}_${ii}" placeholder="${marketLabel("sok")} ${t("cost")}" value="${sokManualPrice !== null && sokManualPrice !== undefined ? sokManualPrice : ""}" onchange="autoSavePrice(${di},${ii},'sok',this.value)"></label><label class="market-price-field"><span>${marketLabel("migros")} ${t("cost")}</span><input type="number" step="0.01" min="0" id="ing_price_migros_${di}_${ii}" placeholder="${marketLabel("migros")} ${t("cost")}" value="${migrosManualPrice !== null && migrosManualPrice !== undefined ? migrosManualPrice : ""}" onchange="autoSavePrice(${di},${ii},'migros',this.value)"></label><button class="btn-pick" onclick="openPickModal(${di},${ii})">${t("pickFromMarket")}</button><button onclick="saveIngredient(${di},${ii})">${t("saveBtn")}</button>${marketButtons}<button class="btn-delete" onclick="removeIngredient(${di},${ii})">${t("deleteBtn")}</button>${pickedSummary}`;
      list.appendChild(row);
    });
  });
}

window.autoSavePrice = function (di, ii, market, value) {
  const raw = String(value || "").trim();
  const price = raw ? Number(raw) : null;
  if (price !== null && (!Number.isFinite(price) || price < 0)) return;

  const ing = normalizeIngredient(desserts[di]?.ingredients?.[ii]);
  if (!ing.marketSelections[market]) {
    ing.marketSelections[market] = {
      market,
      name: "",
      price,
      packageSize: ing.packageSize,
      packageUnit: ing.packageUnit,
    };
  } else {
    ing.marketSelections[market].price = price;
  }
  desserts[di].ingredients[ii] = ing;
  saveLocal();
};

window.findCheapestForSelectedDessert = async function () {
  if (!SCRAPER_API_BASE) await detectServerPort();
  const select = document.getElementById("dessertSelect");
  const resultBox = document.getElementById("marketResult");
  const idx = Number(select?.value ?? -1);
  const dessert = desserts[idx];
  if (!dessert) return (resultBox.innerHTML = `<p>${t("selectDessert")}</p>`);

  const ingredients = (dessert.ingredients || [])
    .map((raw) => {
      const ing = normalizeIngredient(raw);
      const baseName = [ing.name, ing.description]
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        name: baseName,
        marketNames: {
          sok: ing.marketSelections?.sok?.name || baseName,
          migros: ing.marketSelections?.migros?.name || baseName,
        },
        cachedSelections: {
          sok: ing.marketSelections?.sok || null,
          migros: ing.marketSelections?.migros || null,
        },
        quantity: Number(ing.quantity),
        quantityUnit: ing.unit,
        quantityRatio: calculateEffectiveQuantity(
          ing.quantity,
          ing.unit,
          ing.packageSize,
          ing.packageUnit,
        ),
        displayQuantity: `${ing.quantity} ${ing.unit} (pack ${ing.packageSize} ${ing.packageUnit})`,
      };
    })
    .filter((ing) => ing.name && ing.quantity > 0);

  if (!ingredients.length) {
    resultBox.innerHTML = `<p>${t("addIngredientsFirst")}</p>`;
    return;
  }

  resultBox.innerHTML = `<p>${t("searching")}</p>`;
  try {
    const res = await fetch(`${SCRAPER_API_BASE}/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredients }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    recordMonthlyReport(dessert.name, data);
    renderMarketResult(data);
    renderMonthlyReport();
  } catch (err) {
    resultBox.innerHTML = `<p>${t("marketServiceError")}: ${err.message}</p>`;
  }
};

function renderMarketResult(data) {
  const resultBox = document.getElementById("marketResult");
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const totals = data.totals || {};
  const cheapest = data.cheapestMarket || "N/A";
  const cheapestTotal = Number(data.cheapestTotal || 0);

  let html = `<div class="market-table-wrap"><table class="market-table"><thead><tr><th>${t("ingredient")}</th><th>${t("qty")}</th><th>${marketLabel("sok")} ${t("chosenItem")}</th><th>${marketLabel("sok")} ${t("unit")}</th><th>${marketLabel("sok")} ${t("cost")}</th><th>${marketLabel("migros")} ${t("chosenItem")}</th><th>${marketLabel("migros")} ${t("unit")}</th><th>${marketLabel("migros")} ${t("cost")}</th></tr></thead><tbody>`;

  rows.forEach((row) => {
    html += `<tr><td>${escapeText(row.ingredient)}</td><td>${escapeText(row.quantity)}</td><td>${escapeText(row.sok?.name || row.marketNames?.sok || t("unavailable"))}</td><td>${formatTryPrice(row.sok?.unitPrice)}</td><td>${formatTryPrice(row.sok?.cost)}</td><td>${escapeText(row.migros?.name || row.marketNames?.migros || t("unavailable"))}</td><td>${formatTryPrice(row.migros?.unitPrice)}</td><td>${formatTryPrice(row.migros?.cost)}</td></tr>`;
  });

  html += `</tbody></table></div>`;
  html += `<div class="market-totals"><p><strong>Total ${marketLabel("sok")}:</strong> ${formatTryPrice(totals.sok)}</p><p><strong>Total ${marketLabel("migros")}:</strong> ${formatTryPrice(totals.migros)}</p></div>`;
  html += `<p class="best-market">${t("cheapestMarket")}: ${escapeText(marketLabel(cheapest))} (${formatTryPrice(cheapestTotal)})</p>`;
  resultBox.innerHTML = html;
}

window.openMarketLink = function (market, di, ii) {
  const nameEl = document.getElementById(`ing_name_${di}_${ii}`);
  const descEl = document.getElementById(`ing_desc_${di}_${ii}`);
  const query = buildIngredientSearchQuery(nameEl?.value, descEl?.value);
  if (!query) {
    alert(t("writeIngredientFirst"));
    return;
  }
  const config = MARKET_DEFS_V2.find((entry) => entry.key === market);
  if (!config) return;
  window.open(config.url(query), "_blank");
};
