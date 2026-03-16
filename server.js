const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const app = express();

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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.body?.userId || req.get('x-user-id') || "guest";
    const folder = req.body?.folder || req.get('x-folder') || "images";
    const dir = path.join(__dirname, "uploads", String(userId), String(folder));
    try { fs.mkdirSync(dir, { recursive: true }); } catch (err) { console.error(err.message); }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // ✅ No timestamp - use original filename only
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

app.post("/upload", upload.array("file"), (req, res) => {
  try {
    res.json({ status: "ok", files: req.files || [] });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/ping", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Storage usage endpoint
app.get('/storage/:userId', (req, res) => {
  const userId = req.params.userId;
  const userDir = path.join(__dirname, 'uploads', userId);

  const getFolderSize = (dirPath) => {
    if (!fs.existsSync(dirPath)) return 0;
    let total = 0;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) total += getFolderSize(fullPath);
        else if (entry.isFile()) {
          try { total += fs.statSync(fullPath).size; } catch (e) {}
        }
      }
    } catch (e) {}
    return total;
  };

  const categories = ["images", "videos", "documents"];
  const byCategory = {};
  let total = 0;
  for (const cat of categories) {
    const catSize = getFolderSize(path.join(userDir, cat));
    byCategory[cat] = catSize;
    total += catSize;
  }
  res.json({ total, byCategory });
});

// ✅ NEW: Read text file content for preview
app.get('/preview/:userId/:category', (req, res) => {
  const { userId, category } = req.params;
  const filePath = req.query.file;
  if (!filePath) return res.status(400).json({ status: "error", message: "Missing file" });

  const fullPath = path.join(__dirname, 'uploads', userId, category, filePath);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ status: "error", message: "File not found" });

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    res.json({ status: "ok", content });
  } catch (e) {
    res.status(500).json({ status: "error", message: "Cannot read file" });
  }
});

// Browse
app.get('/browse/:userId/:category', (req, res) => {
  const { userId, category } = req.params;
  const subPath = req.query.path || "";
  const dirPath = path.join(__dirname, 'uploads', userId, category, subPath);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  fs.readdir(dirPath, { withFileTypes: true }, (err, entries) => {
    if (err) return res.json({ folders: [], files: [] });
    res.json({
      folders: entries.filter(e => e.isDirectory()).map(e => e.name),
      files: entries.filter(e => e.isFile()).map(e => e.name)
    });
  });
});

// Create folder
app.post('/create-folder', (req, res) => {
  const { userId, category, path: subPath, folderName } = req.body;
  if (!userId || !category || !folderName)
    return res.status(400).json({ status: "error", message: "Missing required fields" });
  const dirPath = path.join(__dirname, 'uploads', userId, category, subPath || "", folderName);
  try {
    if (fs.existsSync(dirPath)) return res.status(409).json({ status: "error", message: "Folder already exists" });
    fs.mkdirSync(dirPath, { recursive: true });
    res.json({ status: "ok", message: "Folder created" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Rename
app.post('/rename', (req, res) => {
  const { userId, category, path: subPath, oldName, newName, isFolder } = req.body;
  if (!userId || !category || !oldName || !newName)
    return res.status(400).json({ status: "error", message: "Missing required fields" });
  const dirPath = path.join(__dirname, 'uploads', userId, category, subPath || "");
  const oldPath = path.join(dirPath, oldName);
  const newPath = path.join(dirPath, newName);
  if (!fs.existsSync(oldPath)) return res.status(404).json({ status: "error", message: "Item not found" });
  if (fs.existsSync(newPath)) return res.status(409).json({ status: "error", message: "Name already exists" });
  try {
    fs.renameSync(oldPath, newPath);
    res.json({ status: "ok", message: "Renamed successfully" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Delete
app.post('/delete', (req, res) => {
  const { userId, category, path: subPath, fileName, isFolder } = req.body;
  if (!userId || !category || !fileName)
    return res.status(400).json({ status: "error", message: "Missing required fields" });
  const itemPath = path.join(__dirname, 'uploads', userId, category, subPath || "", fileName);
  if (!fs.existsSync(itemPath)) return res.status(404).json({ status: "error", message: "Item not found" });
  try {
    if (isFolder) fs.rmSync(itemPath, { recursive: true, force: true });
    else fs.unlinkSync(itemPath);
    res.json({ status: "ok", message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Download
app.get('/download/:userId/:category', (req, res) => {
  const { userId, category } = req.params;
  const filePath = req.query.file;
  if (!filePath) return res.status(400).json({ status: "error", message: "Missing file parameter" });
  const fullFilePath = path.join(__dirname, 'uploads', userId, category, filePath);
  if (!fs.existsSync(fullFilePath)) return res.status(404).json({ status: "error", message: "File not found" });
  res.download(fullFilePath, path.basename(filePath), (err) => {
    if (err) res.status(500).json({ status: "error", message: "Download failed" });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`✅ Storage tracking enabled`);
  console.log(`✅ No timestamp in filenames`);
  console.log(`✅ Text file preview enabled`);
});