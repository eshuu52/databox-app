// Rename file endpoint
app.post('/rename', (req, res) => {
  const { userId, category, oldName, newName } = req.body;
  if (!userId || !category || !oldName || !newName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const dir = path.join(__dirname, 'uploads', userId, category);
  const oldPath = path.join(dir, oldName);
  const newPath = path.join(dir, newName);
  fs.rename(oldPath, newPath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Rename failed', details: err.message });
    }
    res.json({ status: 'ok' });
  });
});
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded files statically (support user/category structure)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = req.body.folder || "root";
    const dir = path.join(__dirname, "uploads", folder);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Upload endpoint (accepts single or multiple files)
app.post("/upload", upload.any(), (req, res) => {
  res.json({ status: "ok", files: req.files });
});

// List files for a user and category (images, videos, documents)
app.get('/files/:userId/:category', (req, res) => {
  const userId = req.params.userId;
  const category = req.params.category || "root";
  const dirPath = path.join(__dirname, 'uploads', userId, category);
  fs.readdir(dirPath, (err, files) => {
    if (err) return res.json([]);
    res.json(files);
  });
});

// (Optional) List all folders in uploads
app.get('/folders', (req, res) => {
  const uploadsDir = path.join(__dirname, 'uploads');
  fs.readdir(uploadsDir, { withFileTypes: true }, (err, files) => {
    if (err) return res.json([]);
    const folders = files.filter(f => f.isDirectory()).map(f => f.name);
    res.json(folders);
  });
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});