require('dotenv').config();
const express = require("express");
const AWS = require("aws-sdk");
const cors = require("cors");
const multer = require("multer");
const app = express();

const B2_CONFIG = {
  accessKeyId: process.env.B2_ACCESS_KEY_ID,
  secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
  endpoint: process.env.B2_ENDPOINT || "https://s3.us-east-005.backblazeb2.com",
  region: process.env.B2_REGION || "us-east-005",
  bucket: process.env.B2_BUCKET || "databox-files"
};

const s3 = new AWS.S3({
  accessKeyId: B2_CONFIG.accessKeyId,
  secretAccessKey: B2_CONFIG.secretAccessKey,
  endpoint: B2_CONFIG.endpoint,
  region: B2_CONFIG.region,
  s3ForcePathStyle: true,
  signatureVersion: 'v4'
});

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://eshuu52.netlify.app',
    'https://databox-app.onrender.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-folder', 'Range']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

app.post("/upload", upload.array("file"), async (req, res) => {
  try {
    const userId = req.body?.userId || req.get('x-user-id') || "guest";
    const folder = req.body?.folder || req.get('x-folder') || "images";
    const results = [];
    for (const file of req.files || []) {
      const key = `${userId}/${folder}/${file.originalname}`;
      const params = {
        Bucket: B2_CONFIG.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
      };
      const uploadResult = await s3.upload(params).promise();
      console.log("✅ Uploaded to B2:", key);
      results.push({ name: file.originalname, url: uploadResult.Location, size: file.size });
    }
    res.json({ status: "ok", files: results });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/ping", (req, res) => {
  res.json({ status: "ok", message: "Server running on Backblaze B2 🚀" });
});

app.get('/storage/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    let total = 0;
    let byCategory = { images: 0, videos: 0, documents: 0 };
    const listAllObjects = async (ContinuationToken = null) => {
      const listParams = { Bucket: B2_CONFIG.bucket, Prefix: `${userId}/` };
      if (ContinuationToken) listParams.ContinuationToken = ContinuationToken;
      const data = await s3.listObjectsV2(listParams).promise();
      for (const obj of data.Contents || []) {
        total += obj.Size;
        const pathParts = obj.Key.replace(`${userId}/`, '').split('/');
        const category = pathParts[0] || 'documents';
        if (['images', 'videos', 'documents'].includes(category)) {
          byCategory[category] += obj.Size;
        }
      }
      if (data.IsTruncated && data.NextContinuationToken) {
        await listAllObjects(data.NextContinuationToken);
      }
    };
    await listAllObjects();
    res.json({ total, byCategory });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get('/browse/:userId/:category', async (req, res) => {
  const { userId, category } = req.params;
  const subPath = req.query.path || "";
  const prefix = subPath ? `${userId}/${category}/${subPath}/` : `${userId}/${category}/`;
  try {
    const data = await s3.listObjectsV2({
      Bucket: B2_CONFIG.bucket, Prefix: prefix, Delimiter: '/'
    }).promise();
    const folders = [];
    const files = [];
    for (const commonPrefix of data.CommonPrefixes || []) {
      const folderName = commonPrefix.Prefix.replace(prefix, '').replace('/', '');
      if (folderName) folders.push(folderName);
    }
    for (const obj of data.Contents || []) {
      const fileName = obj.Key.replace(prefix, '');
      if (fileName && !fileName.endsWith('/')) files.push(fileName);
    }
    res.json({ folders, files });
  } catch (error) {
    console.error("Browse error:", error);
    res.json({ folders: [], files: [] });
  }
});

app.get('/preview/:userId/:category', async (req, res) => {
  const { userId, category } = req.params;
  const filePath = req.query.file;
  if (!filePath) return res.status(400).json({ status: "error", message: "Missing file" });
  const key = `${userId}/${category}/${filePath}`;
  try {
    const data = await s3.getObject({ Bucket: B2_CONFIG.bucket, Key: key }).promise();
    const content = data.Body.toString('utf8');
    res.json({ status: "ok", content });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Cannot read file" });
  }
});

app.post('/create-folder', async (req, res) => {
  const { userId, category, path: subPath, folderName } = req.body;
  if (!userId || !category || !folderName) {
    return res.status(400).json({ status: "error", message: "Missing required fields" });
  }
  const folderKey = subPath
    ? `${userId}/${category}/${subPath}/${folderName}/`
    : `${userId}/${category}/${folderName}/`;
  try {
    await s3.putObject({ Bucket: B2_CONFIG.bucket, Key: folderKey, Body: '', ContentType: 'application/x-directory' }).promise();
    res.json({ status: "ok", message: "Folder created" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post('/rename', async (req, res) => {
  const { userId, category, path: subPath, oldName, newName, isFolder } = req.body;
  if (!userId || !category || !oldName || !newName) {
    return res.status(400).json({ status: "error", message: "Missing required fields" });
  }
  const basePath = subPath ? `${userId}/${category}/${subPath}/` : `${userId}/${category}/`;
  const oldKey = `${basePath}${oldName}${isFolder ? '/' : ''}`;
  const newKey = `${basePath}${newName}${isFolder ? '/' : ''}`;
  try {
    await s3.copyObject({ Bucket: B2_CONFIG.bucket, CopySource: `${B2_CONFIG.bucket}/${oldKey}`, Key: newKey }).promise();
    await s3.deleteObject({ Bucket: B2_CONFIG.bucket, Key: oldKey }).promise();
    res.json({ status: "ok", message: "Renamed successfully" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post('/delete', async (req, res) => {
  const { userId, category, path: subPath, fileName, isFolder } = req.body;
  if (!userId || !category || !fileName) {
    return res.status(400).json({ status: "error", message: "Missing required fields" });
  }
  const basePath = subPath ? `${userId}/${category}/${subPath}/` : `${userId}/${category}/`;
  const key = `${basePath}${fileName}${isFolder ? '/' : ''}`;
  try {
    if (isFolder) {
      const data = await s3.listObjectsV2({ Bucket: B2_CONFIG.bucket, Prefix: key }).promise();
      const deleteObjects = data.Contents.map(obj => ({ Key: obj.Key }));
      if (deleteObjects.length > 0) {
        await s3.deleteObjects({ Bucket: B2_CONFIG.bucket, Delete: { Objects: deleteObjects } }).promise();
      }
    } else {
      await s3.deleteObject({ Bucket: B2_CONFIG.bucket, Key: key }).promise();
    }
    res.json({ status: "ok", message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ✅ NEW: Returns signed URL as JSON — frontend opens it directly (fixes "Failed to fetch")
app.get('/signed-url/:userId/:category', async (req, res) => {
  const { userId, category } = req.params;
  const filePath = req.query.file;
  if (!filePath) return res.status(400).json({ status: "error", message: "Missing file parameter" });
  const key = `${userId}/${category}/${filePath}`;
  try {
    const url = s3.getSignedUrl('getObject', {
      Bucket: B2_CONFIG.bucket,
      Key: key,
      Expires: 3600,
      ResponseContentDisposition: `attachment; filename="${filePath.split('/').pop()}"`
    });
    res.json({ status: "ok", url });
  } catch (error) {
    console.error("Signed URL error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ✅ Keep old /download route for backward compatibility (redirect)
app.get('/download/:userId/:category', async (req, res) => {
  const { userId, category } = req.params;
  const filePath = req.query.file;
  if (!filePath) return res.status(400).json({ status: "error", message: "Missing file parameter" });
  const key = `${userId}/${category}/${filePath}`;
  try {
    const url = s3.getSignedUrl('getObject', {
      Bucket: B2_CONFIG.bucket, Key: key, Expires: 3600
    });
    res.redirect(url);
  } catch (error) {
    res.status(404).json({ status: "error", message: "File not found" });
  }
});

// ✅ Serve files for preview — videos streamed with Range support
app.get('/uploads/:userId/:category/*', async (req, res) => {
  const { userId, category } = req.params;
  const filePath = req.params[0];
  const key = `${userId}/${category}/${filePath}`;
  const videoExtensions = ['mp4', 'webm', 'ogg', 'mov'];
  const ext = filePath.split('.').pop().toLowerCase();
  const isVideoFile = videoExtensions.includes(ext);

  try {
    if (isVideoFile) {
      const rangeHeader = req.headers.range;
      const headData = await s3.headObject({ Bucket: B2_CONFIG.bucket, Key: key }).promise();
      const fileSize = headData.ContentLength;
      const contentType = headData.ContentType || 'video/mp4';

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
        });
        const stream = s3.getObject({
          Bucket: B2_CONFIG.bucket, Key: key, Range: `bytes=${start}-${end}`
        }).createReadStream();
        stream.pipe(res);
        stream.on('error', (err) => { if (!res.headersSent) res.status(500).send("Stream error"); });
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize, 'Content-Type': contentType, 'Accept-Ranges': 'bytes',
        });
        const stream = s3.getObject({ Bucket: B2_CONFIG.bucket, Key: key }).createReadStream();
        stream.pipe(res);
        stream.on('error', (err) => { if (!res.headersSent) res.status(500).send("Stream error"); });
      }
    } else {
      const url = s3.getSignedUrl('getObject', { Bucket: B2_CONFIG.bucket, Key: key, Expires: 3600 });
      res.redirect(url);
    }
  } catch (error) {
    console.error("Preview error:", error);
    res.status(404).send("File not found");
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`✅ Backblaze B2 Connected — Bucket: ${B2_CONFIG.bucket}`);
  console.log(`✅ Download fix: /signed-url route active`);
  console.log(`✅ Video streaming with Range support enabled`);
});