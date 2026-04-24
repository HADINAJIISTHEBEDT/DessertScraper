"use strict";

const fs = require("fs");
const path = require("path");
const {
  compareIngredients,
  searchProduct,
  searchMultiple,
} = require("./scraper");
const {
  initializePushService,
  getPushStatus,
  sendTestNotification,
  scheduleNotification,
  cancelNotification,
} = require("./push-service");

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function jsonResponse(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  };
}

function notFoundPayload(urlPath) {
  return { error: "not found", path: urlPath };
}

function parseRequestBody(rawBody) {
  if (!rawBody) return {};
  if (typeof rawBody === "object") return rawBody;

  try {
    return JSON.parse(rawBody);
  } catch (err) {
    throw new HttpError(400, "invalid json");
  }
}

function normalizeMarket(value) {
  const market = String(value || "").trim().toLowerCase();
  return market;
}

async function routeApiRequest(method, urlPath, body) {
  await initializePushService();

  if (method === "OPTIONS") {
    return jsonResponse(200, { ok: true });
  }

  if (method === "GET" && urlPath === "/health") {
    return jsonResponse(200, {
      status: "ok",
      push: getPushStatus().supported,
      timestamp: Date.now(),
    });
  }

  if (method === "GET" && urlPath === "/push-public-key") {
    const push = getPushStatus();
    if (!push.publicKey) {
      return jsonResponse(503, {
        error: push.reason || "push notifications are not configured",
        supported: false,
      });
    }

    return jsonResponse(200, push);
  }

  if (method !== "POST") {
    throw new HttpError(404, "not found", notFoundPayload(urlPath));
  }

  if (urlPath === "/compare") {
    const ingredients = Array.isArray(body.ingredients) ? body.ingredients : [];
    if (!ingredients.length) {
      throw new HttpError(400, "ingredients array is required");
    }
    return jsonResponse(200, await compareIngredients(ingredients));
  }

  if (urlPath === "/search") {
    const product = String(body.product || "").trim();
    const market = normalizeMarket(body.market);
    if (!product) {
      throw new HttpError(400, "product name is required");
    }
    if (market !== "sok") {
      throw new HttpError(400, "market must be sok");
    }
    return jsonResponse(
      200,
      (await searchProduct(product, market)) || { error: "No product found" },
    );
  }

  if (urlPath === "/search-all") {
    const product = String(body.product || "").trim();
    if (!product) {
      throw new HttpError(400, "product name is required");
    }
    return jsonResponse(200, await searchMultiple(product));
  }

  if (urlPath === "/push-test") {
    return jsonResponse(200, await sendTestNotification(body));
  }

  if (urlPath === "/push-schedule") {
    return jsonResponse(200, await scheduleNotification(body));
  }

  if (urlPath === "/push-cancel") {
    return jsonResponse(200, await cancelNotification(body));
  }

  throw new HttpError(404, "not found", notFoundPayload(urlPath));
}

function handleRouteError(err, urlPath) {
  if (err instanceof HttpError) {
    return jsonResponse(
      err.statusCode,
      err.details || { error: err.message, path: urlPath },
    );
  }

  const statusCode = Number(err?.statusCode || 500);
  const payload =
    statusCode >= 500
      ? { error: err?.message || "internal error", path: urlPath }
      : { error: err?.message || "request failed", path: urlPath };

  return jsonResponse(statusCode, payload);
}

function isStaticFileRequest(urlPath) {
  return Boolean(MIME[path.extname(urlPath)]);
}

function serveStaticFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const response = jsonResponse(404, { error: "not found" });
      res.writeHead(response.statusCode, response.headers);
      res.end(response.body);
      return;
    }

    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  });
}

function createNodeRequestListener() {
  return (req, res) => {
    const urlPath = String(req.url || "/").split("?")[0] || "/";

    if (req.method === "GET" && (urlPath === "/" || isStaticFileRequest(urlPath))) {
      const normalizedPath = urlPath === "/" ? "/index.html" : urlPath;
      serveStaticFile(res, path.join(__dirname, normalizedPath));
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      try {
        const response = await routeApiRequest(
          req.method || "GET",
          urlPath,
          parseRequestBody(body),
        );
        res.writeHead(response.statusCode, response.headers);
        res.end(response.body);
      } catch (err) {
        const response = handleRouteError(err, urlPath);
        res.writeHead(response.statusCode, response.headers);
        res.end(response.body);
      }
    });
  };
}

async function handleNetlifyEvent(event) {
  const method = event.httpMethod || "GET";
  let urlPath = event.rawPath || event.path || "/";

  urlPath = urlPath.replace(/^.*\.netlify\/functions\/api/, "");
  if (!urlPath.startsWith("/")) {
    urlPath = `/${urlPath}`;
  }
  urlPath = urlPath.split("?")[0];

  try {
    const body = event.isBase64Encoded && event.body
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    return await routeApiRequest(method, urlPath, parseRequestBody(body));
  } catch (err) {
    return handleRouteError(err, urlPath);
  }
}

module.exports = {
  createNodeRequestListener,
  handleNetlifyEvent,
  routeApiRequest,
};
