const https = require("https");
const fs = require("fs");
const path = require("path");
const dns = require("dns");
const zlib = require("zlib");
const { promisify } = require("util");
const os = require("os");

// Resolve data directory — mirrors src/lib/dataPaths.ts logic.
function getDataDir() {
  if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR.trim());
  return path.join(os.homedir(), ".routiform");
}

const TARGET_HOST = "daily-cloudcode-pa.googleapis.com";
const LOCAL_PORT = 443;
const ROUTER_URL = "http://localhost:20128/v1/chat/completions";
const API_KEY = process.env.ROUTER_API_KEY;
const DATA_DIR = getDataDir();
const DB_FILE = path.join(DATA_DIR, "db.json");
const SQLITE_FILE = path.join(DATA_DIR, "storage.sqlite");

let _sqliteDb = null;

const ENABLE_FILE_LOG = false;

if (!API_KEY) {
  console.error("\u274c ROUTER_API_KEY required");
  process.exit(1);
}

// ── SSL Certificates ─────────────────────────────────────────────
const certDir = path.join(DATA_DIR, "mitm");
const rootKey = fs.readFileSync(path.join(certDir, "server.key"));
const rootCert = fs.readFileSync(path.join(certDir, "server.crt"));
const rootCAPem = rootCert.toString("utf8");

const certCache = new Map();

function sniCallback(servername, cb) {
  try {
    if (certCache.has(servername)) return cb(null, certCache.get(servername));
    const ctx = require("tls").createSecureContext({
      key: rootKey,
      cert: rootCert.toString() + "\n" + rootCAPem,
    });
    certCache.set(servername, ctx);
    console.log(`\u{1f512} Cert generated: ${servername}`);
    cb(null, ctx);
  } catch (e) {
    console.error(`\u274c Cert failed: ${e.message}`);
    cb(e);
  }
}

const sslOptions = {
  key: rootKey,
  cert: rootCert,
  SNICallback: sniCallback,
};

// ── Chat endpoints ───────────────────────────────────────────────
const CHAT_URL_PATTERNS = [":generateContent", ":streamGenerateContent"];

// ── Log blacklist (telemetry, polling) ───────────────────────────
const LOG_BLACKLIST_URL_PARTS = [
  "recordCodeAssistMetrics",
  "recordTrajectoryAnalytics",
  "fetchAdminControls",
  "listExperiments",
  "fetchUserInfo",
];

// ── Logger / Dumper ──────────────────────────────────────────────
const DUMP_DIR = path.join(DATA_DIR, "logs", "mitm");
if (ENABLE_FILE_LOG && !fs.existsSync(DUMP_DIR)) {
  fs.mkdirSync(DUMP_DIR, { recursive: true });
}

const EMPTY_BODY_RE = /^\s*(\{\s*\}|\[\s*\]|null)?\s*$/;

function slugify(s, max) {
  return String(s || "").replace(/[^a-zA-Z0-9]/g, "_").substring(0, max || 80);
}

function isBlacklisted(url) {
  if (!url) return false;
  return LOG_BLACKLIST_URL_PARTS.some(function (part) {
    return url.includes(part);
  });
}

function decodeBody(buf, encoding) {
  if (!buf || buf.length === 0) return buf;
  try {
    var enc = (encoding || "").toLowerCase();
    if (enc.includes("gzip")) return zlib.gunzipSync(buf);
    if (enc.includes("br")) return zlib.brotliDecompressSync(buf);
    if (enc.includes("deflate")) return zlib.inflateSync(buf);
  } catch (e) {
    /* return raw */
  }
  return buf;
}

function dumpRequest(req, bodyBuffer, tag) {
  if (!ENABLE_FILE_LOG) return null;
  tag = tag || "raw";
  if (isBlacklisted(req.url)) return null;
  try {
    var ts = new Date().toISOString().replace(/[:.]/g, "-");
    var slug = slugify((req.headers.host || "") + req.url);
    var file = path.join(DUMP_DIR, ts + "_" + tag + "_" + slug + ".req.json");
    var parsed = null;
    try {
      parsed = JSON.parse(bodyBuffer.toString());
    } catch (e) {
      /* not JSON */
    }
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          method: req.method,
          url: req.url,
          host: req.headers.host,
          headers: req.headers,
          body: parsed !== null ? parsed : bodyBuffer.toString("utf8"),
        },
        null,
        2
      )
    );
    return file;
  } catch (e) {
    return null;
  }
}

function createResponseDumper(req, tag) {
  if (!ENABLE_FILE_LOG) return null;
  tag = tag || "raw";
  if (isBlacklisted(req.url)) return null;
  var ts = new Date().toISOString().replace(/[:.]/g, "-");
  var slug = slugify((req.headers.host || "") + req.url);
  var file = path.join(DUMP_DIR, ts + "_" + tag + "_" + slug + ".res.txt");
  var status = 0;
  var headers = {};
  var chunks = [];
  return {
    writeHeader: function (s, h) {
      status = s;
      headers = h || {};
    },
    writeChunk: function (chunk) {
      if (chunk == null) return;
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    },
    end: function () {
      try {
        var raw = Buffer.concat(chunks);
        var enc = headers["content-encoding"] || headers["Content-Encoding"];
        var decoded = decodeBody(raw, enc);
        var text = decoded.toString("utf8");
        if (EMPTY_BODY_RE.test(text)) return;
        var cleanHeaders = Object.assign({}, headers);
        delete cleanHeaders["content-encoding"];
        delete cleanHeaders["Content-Encoding"];
        var out =
          "STATUS: " + status + "\nHEADERS: " + JSON.stringify(cleanHeaders, null, 2) + "\n---BODY---\n" + text;
        fs.writeFileSync(file, out);
      } catch (e) {
        /* ignore */
      }
    },
    file: file,
  };
}

// ── Resolve real IP ──────────────────────────────────────────────
let cachedTargetIP = null;
async function resolveTargetIP() {
  if (cachedTargetIP) return cachedTargetIP;
  var resolver = new dns.Resolver();
  resolver.setServers(["8.8.8.8"]);
  var resolve4 = promisify(resolver.resolve4.bind(resolver));
  var addresses = await resolve4(TARGET_HOST);
  cachedTargetIP = addresses[0];
  return cachedTargetIP;
}

// ── Body & model helpers ─────────────────────────────────────────
function collectBodyRaw(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on("data", function (chunk) {
      chunks.push(chunk);
    });
    req.on("end", function () {
      resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

function extractModel(body) {
  try {
    return JSON.parse(body.toString()).model || null;
  } catch (e) {
    return null;
  }
}

function getSqliteDb() {
  if (_sqliteDb) return _sqliteDb;
  try {
    var Database = require("better-sqlite3");
    if (fs.existsSync(SQLITE_FILE)) {
      _sqliteDb = new Database(SQLITE_FILE, { readonly: true });
      return _sqliteDb;
    }
  } catch (e) {
    /* not available */
  }
  return null;
}

function getMappedModel(model) {
  if (!model) return null;
  try {
    var db = getSqliteDb();
    if (db) {
      var row = db
        .prepare(
          "SELECT value FROM key_value WHERE namespace = 'mitmAlias' AND key = 'antigravity'"
        )
        .get();
      if (row) {
        var mappings = JSON.parse(row.value);
        return mappings[model] || null;
      }
    }
  } catch (e) {
    /* fall through */
  }
  try {
    if (fs.existsSync(DB_FILE)) {
      var dbJson = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      return dbJson.mitmAlias && dbJson.mitmAlias.antigravity
        ? dbJson.mitmAlias.antigravity[model] || null
        : null;
    }
  } catch (e) {
    /* ignore */
  }
  return null;
}

// ── Passthrough ──────────────────────────────────────────────────
async function passthrough(req, res, bodyBuffer, onResponse) {
  var targetIP = await resolveTargetIP();
  var rejectUnauthorized = process.env.MITM_DISABLE_TLS_VERIFY !== "1";
  var dumper = createResponseDumper(req, "passthrough");

  var forwardReq = https.request(
    {
      hostname: targetIP,
      port: 443,
      path: req.url,
      method: req.method,
      headers: Object.assign({}, req.headers, { host: TARGET_HOST }),
      servername: TARGET_HOST,
      rejectUnauthorized: rejectUnauthorized,
    },
    function (forwardRes) {
      res.writeHead(forwardRes.statusCode, forwardRes.headers);
      if (dumper) dumper.writeHeader(forwardRes.statusCode, forwardRes.headers);

      if (!onResponse && !dumper) {
        forwardRes.pipe(res);
        return;
      }

      var chunks = [];
      forwardRes.on("data", function (chunk) {
        if (dumper) dumper.writeChunk(chunk);
        if (onResponse) chunks.push(chunk);
        res.write(chunk);
      });
      forwardRes.on("end", function () {
        if (dumper) dumper.end();
        res.end();
        if (onResponse) {
          try {
            onResponse(Buffer.concat(chunks), forwardRes.headers);
          } catch (e) {
            /* ignore */
          }
        }
      });
    }
  );

  forwardReq.on("error", function (e) {
    console.error("\u274c Passthrough error: " + e.message);
    if (dumper) {
      dumper.writeChunk("\n[ERROR] " + e.message + "\n");
      dumper.end();
    }
    if (!res.headersSent) res.writeHead(502);
    res.end("Bad Gateway");
  });

  if (bodyBuffer.length > 0) forwardReq.write(bodyBuffer);
  forwardReq.end();
}

// ── Intercept ────────────────────────────────────────────────────
async function intercept(req, res, bodyBuffer, mappedModel) {
  var dumper = createResponseDumper(req, "intercept-antigravity");
  var isStream = req.url.includes(":streamGenerateContent");
  try {
    var body = JSON.parse(bodyBuffer.toString());
    body.model = mappedModel;

    var response = await fetch(ROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (dumper) dumper.writeHeader(response.status, Object.fromEntries(response.headers));

    if (!response.ok) {
      var errText = await response.text().catch(function () {
        return "";
      });
      throw new Error("Routiform " + response.status + ": " + errText);
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    var reader = response.body.getReader();
    var decoder = new TextDecoder();

    while (true) {
      var _ref = await reader.read();
      var done = _ref.done;
      var value = _ref.value;
      if (done) {
        if (dumper) dumper.end();
        res.end();
        break;
      }
      if (dumper) dumper.writeChunk(value);
      res.write(decoder.decode(value, { stream: true }));
    }
  } catch (error) {
    console.error("\u274c " + error.message);
    if (dumper) {
      dumper.writeChunk("\n[ERROR] " + error.message + "\n");
      dumper.end();
    }
    if (isStream) {
      if (!res.headersSent)
        res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(
        "data: " + JSON.stringify({ error: { message: error.message } }) + "\r\n\r\n"
      );
    } else {
      if (!res.headersSent)
        res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: { message: error.message, type: "mitm_error" } })
      );
    }
  }
}

// ── Main server ──────────────────────────────────────────────────
var server = https.createServer(sslOptions, async function (req, res) {
  var bodyBuffer = await collectBodyRaw(req);

  if (ENABLE_FILE_LOG) dumpRequest(req, bodyBuffer, "raw");

  if (req.headers["x-routiform-source"] === "routiform") {
    return passthrough(req, res, bodyBuffer);
  }

  var isChatRequest = CHAT_URL_PATTERNS.some(function (p) {
    return req.url.includes(p);
  });

  if (!isChatRequest) {
    return passthrough(req, res, bodyBuffer);
  }

  var model = extractModel(bodyBuffer);
  var mappedModel = getMappedModel(model);

  if (!mappedModel) {
    return passthrough(req, res, bodyBuffer);
  }

  console.log("\u{1f500} " + model + " \u2192 " + mappedModel);
  return intercept(req, res, bodyBuffer, mappedModel);
});

server.listen(LOCAL_PORT, function () {
  console.log("\u{1f680} MITM ready on :" + LOCAL_PORT + " \u2192 " + ROUTER_URL);
});

server.on("error", function (error) {
  if (error.code === "EADDRINUSE") {
    console.error("\u274c Port " + LOCAL_PORT + " already in use");
  } else if (error.code === "EACCES") {
    console.error("\u274c Permission denied for port " + LOCAL_PORT);
  } else {
    console.error("\u274c " + error.message);
  }
  process.exit(1);
});

process.on("SIGTERM", function () {
  server.close(function () {
    process.exit(0);
  });
});
process.on("SIGINT", function () {
  server.close(function () {
    process.exit(0);
  });
});
