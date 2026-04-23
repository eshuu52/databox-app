const express = require("express");
const AWS = require("aws-sdk");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const app = express();

// 🔑 BACKBLAZE B2 - YOUR KEYS (10GB FREE FOREVER!)
const B2_CONFIG = {
  accessKeyId: "005351b4969f7ee0000000001",
  secretAccessKey: "K0052u0bB6bbW47cr1RHxHWjjEci+BM",
  endpoint: "https://s3.us-east-005.backblazeb2.com",
  region: "us-east-005",
  bucket: "databox-files"
};

// AWS S3 client for Backblaze B2 (S3-compatible)
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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-folder']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Memory storage - NO local disk needed for Render free tier!
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
      results.push({ 
        name: file.originalname, 
        url: uploadResult.Location,
        size: file.size 
      });
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

// ✅ Storage usage (scans B2 bucket)
app.get('/storage/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const params = {
      Bucket: B2_CONFIG.bucket,
      Prefix: `${userId}/`
    };
    
    let total = 0;
    let byCategory = { images: 0, videos: 0, documents: 0 };
    
    const listAllObjects = async (ContinuationToken = null) => {
      const listParams = { ...params };
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

// ✅ Browse B2 bucket
app.get('/browse/:userId/:category', async (req, res) => {
  const { userId, category } = req.params;
  const subPath = req.query.path || "";
  const prefix = subPath ? `${userId}/${category}/${subPath}/` : `${userId}/${category}/`;
  
  try {
    const params = {
      Bucket: B2_CONFIG.bucket,
      Prefix: prefix,
      Delimiter: '/'
    };
    
    const data = await s3.listObjectsV2(params).promise();
    
    const folders = [];
    const files = [];
    
    for (const commonPrefix of data.CommonPrefixes || []) {
      const folderName = commonPrefix.Prefix.replace(prefix, '').replace('/', '');
      if (folderName) folders.push(folderName);
    }
    
    for (const obj of data.Contents || []) {
      const fileName = obj.Key.replace(prefix, '');
      if (fileName && !fileName.endsWith('/')) {
        files.push(fileName);
      }
    }
    
    console.log(`📂 Browse: ${prefix} → Folders: ${folders.length}, Files: ${files.length}`);
    res.json({ folders, files });
  } catch (error) {
    console.error("Browse error:", error);
    res.json({ folders: [], files: [] });
  }
});

// ✅ Text file preview from B2
app.get('/preview/:userId/:category', async (req, res) => {
  const { userId, category } = req.params;
  const filePath = req.query.file;
  if (!filePath) return res.status(400).json({ status: "error", message: "Missing file" });
  
  const key = `${userId}/${category}/${filePath}`;
  
  try {
    const data = await s3.getObject({
      Bucket: B2_CONFIG.bucket,
      Key: key
    }).promise();
    
    const content = data.Body.toString('utf8');
    res.json({ status: "ok", content });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Cannot read file" });
  }
});

// ✅ Create folder (B2 prefix)
app.post('/create-folder', async (req, res) => {
  const { userId, category, path: subPath, folderName } = req.body;
  if (!userId || !category || !folderName) {
    return res.status(400).json({ status: "error", message: "Missing required fields" });
  }
  
  const folderKey = subPath 
    ? `${userId}/${category}/${subPath}/${folderName}/`
    : `${userId}/${category}/${folderName}/`;
  
  try {
    // Create empty object to mark folder
    await s3.putObject({
      Bucket: B2_CONFIG.bucket,
      Key: folderKey,
      Body: '',
      ContentType: 'application/x-directory'
    }).promise();
    
    console.log("✅ Created folder:", folderKey);
    res.json({ status: "ok", message: "Folder created" });
  } catch (error) {
    console.error("Create folder error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ✅ Rename (copy + delete)
app.post('/rename', async (req, res) => {
  const { userId, category, path: subPath, oldName, newName, isFolder } = req.body;
  if (!userId || !category || !oldName || !newName) {
    return res.status(400).json({ status: "error", message: "Missing required fields" });
  }
  
  const basePath = subPath ? `${userId}/${category}/${subPath}/` : `${userId}/${category}/`;
  const oldKey = `${basePath}${oldName}${isFolder ? '/' : ''}`;
  const newKey = `${basePath}${newName}${isFolder ? '/' : ''}`;
  
  try {
    // Copy to new location
    await s3.copyObject({
      Bucket: B2_CONFIG.bucket,
      CopySource: `${B2_CONFIG.bucket}/${oldKey}`,
      Key: newKey
    }).promise();
    
    // Delete old
    await s3.deleteObject({ Bucket: B2_CONFIG.bucket, Key: oldKey }).promise();
    
    console.log("✅ Renamed:", oldKey, "→", newKey);
    res.json({ status: "ok", message: "Renamed successfully" });
  } catch (error) {
    console.error("Rename error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ✅ Delete
app.post('/delete', async (req, res) => {
  const { userId, category, path: subPath, fileName, isFolder } = req.body;
  if (!userId || !category || !fileName) {
    return res.status(400).json({ status: "error", message: "Missing required fields" });
  }
  
  const basePath = subPath ? `${userId}/${category}/${subPath}/` : `${userId}/${category}/`;
  const key = `${basePath}${fileName}${isFolder ? '/' : ''}`;
  
  try {
    if (isFolder) {
      // Delete folder and contents
      const listParams = { Bucket: B2_CONFIG.bucket, Prefix: key };
      const data = await s3.listObjectsV2(listParams).promise();
      const deleteObjects = data.Contents.map(obj => ({ Key: obj.Key }));
      
      if (deleteObjects.length > 0) {
        await s3.deleteObjects({
          Bucket: B2_CONFIG.bucket,
          Delete: { Objects: deleteObjects }
        }).promise();
        console.log("✅ Deleted folder:", key, `(${deleteObjects.length} items)`);
      }
    } else {
      await s3.deleteObject({ Bucket: B2_CONFIG.bucket, Key: key }).promise();
      console.log("✅ Deleted file:", key);
    }
    
    res.json({ status: "ok", message: "Deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ✅ Download (signed URL)
app.get('/download/:userId/:category', async (req, res) => {
  const { userId, category } = req.params;
  const filePath = req.query.file;
  if (!filePath) return res.status(400).json({ status: "error", message: "Missing file parameter" });
  
  const key = `${userId}/${category}/${filePath}`;
  
  try {
    const url = s3.getSignedUrl('getObject', {
      Bucket: B2_CONFIG.bucket,
      Key: key,
      Expires: 3600 // 1 hour
    });
    
    res.redirect(url);
  } catch (error) {
    console.error("Download error:", error);
    res.status(404).json({ status: "error", message: "File not found" });
  }
});

// ✅ Serve uploaded files (for preview)
app.get('/uploads/:userId/:category/*', async (req, res) => {
  const { userId, category } = req.params;
  const filePath = req.params[0];
  const key = `${userId}/${category}/${filePath}`;
  
  try {
    const url = s3.getSignedUrl('getObject', {
      Bucket: B2_CONFIG.bucket,
      Key: key,
      Expires: 3600
    });
    
    res.redirect(url);
  } catch (error) {
    console.error("Preview error:", error);
    res.status(404).send("File not found");
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`✅ Backblaze B2 Connected!`);
  console.log(`   - Bucket: ${B2_CONFIG.bucket}`);
  console.log(`   - Endpoint: ${B2_CONFIG.endpoint}`);
  console.log(`   - Region: ${B2_CONFIG.region}`);
  console.log(`✅ 10GB FREE storage - Files stored PERMANENTLY!`);
  console.log(`✅ Render free tier PERFECTLY supported!`);
});