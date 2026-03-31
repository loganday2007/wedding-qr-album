const path = require("path");
const crypto = require("crypto");

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const archiver = require("archiver");
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const PORT = Number(process.env.PORT || 8787);
const EVENT_SLUG = process.env.EVENT_SLUG || "wedding-event";
const EXPECTED_EVENT_SLUG = (EVENT_SLUG || "").replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "wedding-event";
const HOST_ACCESS_CODE = process.env.HOST_ACCESS_CODE || "";
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 2048);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const required = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

if (!HOST_ACCESS_CODE) {
  console.error("Missing HOST_ACCESS_CODE in environment.");
  process.exit(1);
}

const s3 = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || "false").toLowerCase() === "true",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET;
const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.resolve(__dirname)));

const sanitizeFileName = (name) => {
  const base = path.basename(name || "upload");
  return base.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 160);
};

const safeSlug = (slug) => {
  const normalized = (slug || "").trim();
  if (!normalized) return EXPECTED_EVENT_SLUG;
  return normalized.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80);
};

const requireHostCode = (code) => code && code === HOST_ACCESS_CODE;

const listAllObjects = async (prefix) => {
  const objects = [];
  let continuationToken;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    objects.push(...(page.Contents || []));
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, eventSlug: EXPECTED_EVENT_SLUG, maxUploadMb: MAX_UPLOAD_MB });
});

app.post("/api/presign-upload", async (req, res) => {
  try {
    const { eventSlug, filename, contentType, size } = req.body || {};
    const slug = safeSlug(eventSlug);
    if (slug !== EXPECTED_EVENT_SLUG) {
      return res.status(403).json({ error: "Invalid event slug." });
    }

    if (!filename || typeof filename !== "string") {
      return res.status(400).json({ error: "filename is required" });
    }

    const numericSize = Number(size || 0);
    if (!Number.isFinite(numericSize) || numericSize <= 0) {
      return res.status(400).json({ error: "Invalid file size" });
    }

    if (numericSize > MAX_UPLOAD_BYTES) {
      return res.status(413).json({
        error: `File too large. Max allowed is ${MAX_UPLOAD_MB} MB.`,
      });
    }

    const safeName = sanitizeFileName(filename);
    const stamp = Date.now();
    const nonce = crypto.randomBytes(4).toString("hex");
    const objectKey = `${slug}/${stamp}-${nonce}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
      ContentType: contentType || "application/octet-stream",
      Metadata: {
        event: slug,
      },
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 15 });
    return res.json({ uploadUrl, objectKey });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not generate upload URL." });
  }
});

app.get("/api/list", async (req, res) => {
  try {
    const eventSlug = safeSlug(req.query.eventSlug);
    const code = String(req.query.code || "");

    if (!requireHostCode(code)) {
      return res.status(401).json({ error: "Invalid host code." });
    }

    if (eventSlug !== EXPECTED_EVENT_SLUG) {
      return res.status(403).json({ error: "Invalid event slug." });
    }

    const files = await Promise.all(
      (await listAllObjects(`${eventSlug}/`)).map(async (entry) => {
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET,
          Key: entry.Key,
          ResponseContentDisposition: `attachment; filename=\"${path.basename(entry.Key)}\"`,
        });
        const downloadUrl = await getSignedUrl(s3, getCommand, { expiresIn: 60 * 60 });

        return {
          key: entry.Key,
          size: entry.Size || 0,
          lastModified: entry.LastModified || null,
          downloadUrl,
        };
      })
    );

    files.sort((a, b) => new Date(b.lastModified || 0) - new Date(a.lastModified || 0));

    return res.json({ files });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not list files." });
  }
});

app.get("/api/export-zip", async (req, res) => {
  try {
    const eventSlug = safeSlug(req.query.eventSlug);
    const code = String(req.query.code || "");

    if (!requireHostCode(code)) {
      return res.status(401).json({ error: "Invalid host code." });
    }

    if (eventSlug !== EXPECTED_EVENT_SLUG) {
      return res.status(403).json({ error: "Invalid event slug." });
    }

    const objects = await listAllObjects(`${eventSlug}/`);
    if (!objects.length) {
      return res.status(404).json({ error: "No files found to export." });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=\"${eventSlug}-originals-${timestamp}.zip\"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (error) => {
      throw error;
    });
    archive.pipe(res);

    const usedNames = new Map();

    for (const obj of objects) {
      const key = obj.Key;
      const relativePath = key.startsWith(`${eventSlug}/`) ? key.slice(eventSlug.length + 1) : path.basename(key);

      let entryName = relativePath || path.basename(key);
      if (usedNames.has(entryName)) {
        const next = usedNames.get(entryName) + 1;
        usedNames.set(entryName, next);
        const ext = path.extname(entryName);
        const stem = entryName.slice(0, ext ? -ext.length : undefined);
        entryName = `${stem}-${next}${ext}`;
      } else {
        usedNames.set(entryName, 1);
      }

      const object = await s3.send(
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: key,
        })
      );

      archive.append(object.Body, { name: entryName });
    }

    await archive.finalize();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Could not export zip." });
    }
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Wedding album server running on http://localhost:${PORT}`);
});
