import fs from "fs";
import path from "path";
import zlib from "zlib";
import { resolveDataDir } from "@/lib/dataPaths";
import { LOG_BLACKLIST_URL_PARTS } from "./config";

const DUMP_DIR = path.join(resolveDataDir(), "logs", "mitm");
if (!fs.existsSync(DUMP_DIR)) fs.mkdirSync(DUMP_DIR, { recursive: true });

const EMPTY_BODY_RE = /^\s*(\{\s*\}|\[\s*\]|null)?\s*$/;

function slugify(s: string, max = 80): string {
  return String(s)
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, max);
}

function isBlacklisted(url: string): boolean {
  if (!url) return false;
  return LOG_BLACKLIST_URL_PARTS.some((part) => url.includes(part));
}

function decodeBody(buf: Buffer, encoding?: string): Buffer {
  if (!buf || buf.length === 0) return buf;
  try {
    const enc = (encoding || "").toLowerCase();
    if (enc.includes("gzip")) return zlib.gunzipSync(buf);
    if (enc.includes("br")) return zlib.brotliDecompressSync(buf);
    if (enc.includes("deflate")) return zlib.inflateSync(buf);
  } catch {
    /* return raw on failure */
  }
  return buf;
}

export interface ResponseDumper {
  writeHeader(status: number, headers: Record<string, string>): void;
  writeChunk(chunk: Buffer | string): void;
  end(): void;
  file: string;
}

export function dumpRequest(
  req: { method: string; url: string; headers: Record<string, string> },
  bodyBuffer: Buffer,
  tag = "raw"
): string | null {
  if (isBlacklisted(req.url)) return null;
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const slug = slugify((req.headers.host || "") + req.url);
    const file = path.join(DUMP_DIR, `${ts}_${tag}_${slug}.req.json`);
    let parsed = null;
    try {
      parsed = JSON.parse(bodyBuffer.toString());
    } catch {
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
          body: parsed ?? bodyBuffer.toString("utf8"),
        },
        null,
        2
      )
    );
    return file;
  } catch {
    return null;
  }
}

export function createResponseDumper(
  req: { url: string; headers: Record<string, string> },
  tag = "raw"
): ResponseDumper | null {
  if (isBlacklisted(req.url)) return null;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = slugify((req.headers.host || "") + req.url);
  const file = path.join(DUMP_DIR, `${ts}_${tag}_${slug}.res.txt`);
  let status = 0;
  let headers: Record<string, string> = {};
  const chunks: Buffer[] = [];
  return {
    writeHeader: (s, h) => {
      status = s;
      headers = h || {};
    },
    writeChunk: (chunk) => {
      if (chunk == null) return;
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    },
    end: () => {
      try {
        const raw = Buffer.concat(chunks);
        const enc = headers["content-encoding"] || headers["Content-Encoding"];
        const decoded = decodeBody(raw, enc);
        const text = decoded.toString("utf8");
        if (EMPTY_BODY_RE.test(text)) return;
        const cleanHeaders = { ...headers };
        delete cleanHeaders["content-encoding"];
        delete cleanHeaders["Content-Encoding"];
        const out = `STATUS: ${status}\nHEADERS: ${JSON.stringify(cleanHeaders, null, 2)}\n---BODY---\n${text}`;
        fs.writeFileSync(file, out);
      } catch {
        /* ignore */
      }
    },
    file,
  };
}
