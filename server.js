const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Custom multer storage with field handling
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Access fields from req.body (multer parses form fields into req.body)
    const userId = req.body?.userId || req.body?.['x-user-id'] || req.get('x-user-id') || "guest";
    const folder = req.body?.folder || req.body?.['x-folder'] || req.get('x-folder') || "images";
    
    console.log("\n=== UPLOAD REQUEST ===");
    console.log("All body fields:", Object.keys(req.body || {}));
    console.log("userId:", userId);
    console.log("folder:", folder);
    
    const dir = path.join(__dirname, "uploads", String(userId), String(folder));
    console.log("Saving to:", dir);
    
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log("Directory created successfully");
    } catch (err) {
      console.error("Error creating directory:", err.message);
    }
    
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    cb(null, timestamp + "-" + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Upload endpoint - use upload.fields() to get both files and fields
app.post("/upload", upload.array("file"), (req, res) => {
  try {
    console.log("=== UPLOAD COMPLETE ===");
    console.log("Files uploaded:", req.files?.length || 0);
    console.log("Request body:", req.body);
    res.json({ status: "ok", files: req.files || [] });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Test endpoint to verify server is running
app.get("/ping", (req, res) => {
  console.log("Ping received");
  res.json({ status: "ok", message: "Server is running" });
});

// List files in a folder (images, videos, documents)
app.get('/files/:userId/:folder', (req, res) => {
  const userId = req.params.userId;
  const folder = req.params.folder;
  const dirPath = path.join(__dirname, 'uploads', userId, folder);
  
  console.log("\n=== LIST FILES ===");
  console.log("Fetching from:", dirPath);
  
  fs.readdir(dirPath, (err, files) => {
    if (err) {
      console.error("Error reading directory:", err.message);
      return res.json([]);
    }
    console.log("Files found:", files?.length || 0, files);
    res.json(files || []);
  });
});

// ✅ RENAME ENDPOINT
app.post('/rename', (req, res) => {
  const { userId, category, oldName, newName } = req.body;
  
  console.log("\n=== RENAME REQUEST ===");
  console.log("userId:", userId);
  console.log("category:", category);
  console.log("oldName:", oldName);
  console.log("newName:", newName);
  
  // Validate input
  if (!userId || !category || !oldName || !newName) {
    console.error("Missing required fields");
    return res.status(400).json({ 
      status: "error", 
      message: "Missing required fields: userId, category, oldName, newName" 
    });
  }
  
  // Build file paths
  const dirPath = path.join(__dirname, 'uploads', userId, category);
  const oldPath = path.join(dirPath, oldName);
  const newPath = path.join(dirPath, newName);
  
  console.log("Old path:", oldPath);
  console.log("New path:", newPath);
  
  // Check if old file exists
  if (!fs.existsSync(oldPath)) {
    console.error("Old file does not exist:", oldPath);
    return res.status(404).json({ 
      status: "error", 
      message: "File not found: " + oldName 
    });
  }
  
  // Check if new filename already exists
  if (fs.existsSync(newPath)) {
    console.error("New filename already exists:", newPath);
    return res.status(409).json({ 
      status: "error", 
      message: "A file with the name '" + newName + "' already exists" 
    });
  }
  
  // Perform the rename
  try {
    fs.renameSync(oldPath, newPath);
    console.log("✅ Rename successful!");
    res.json({ 
      status: "ok", 
      message: "File renamed successfully",
      oldName: oldName,
      newName: newName
    });
  } catch (error) {
    console.error("Rename error:", error);
    res.status(500).json({ 
      status: "error", 
      message: "Failed to rename file: " + error.message 
    });
  }
});

// ✅ DELETE ENDPOINT - NEW!
app.post('/delete', (req, res) => {
  const { userId, category, fileName } = req.body;
  
  console.log("\n=== DELETE REQUEST ===");
  console.log("userId:", userId);
  console.log("category:", category);
  console.log("fileName:", fileName);
  
  // Validate input
  if (!userId || !category || !fileName) {
    console.error("Missing required fields");
    return res.status(400).json({ 
      status: "error", 
      message: "Missing required fields: userId, category, fileName" 
    });
  }
  
  // Build file path
  const filePath = path.join(__dirname, 'uploads', userId, category, fileName);
  
  console.log("Deleting file:", filePath);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error("File does not exist:", filePath);
    return res.status(404).json({ 
      status: "error", 
      message: "File not found: " + fileName 
    });
  }
  
  // Perform the delete
  try {
    fs.unlinkSync(filePath);
    console.log("✅ Delete successful!");
    res.json({ 
      status: "ok", 
      message: "File deleted successfully",
      fileName: fileName
    });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ 
      status: "error", 
      message: "Failed to delete file: " + error.message 
    });
  }
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Upload endpoint: http://localhost:${PORT}/upload`);
  console.log(`Rename endpoint: http://localhost:${PORT}/rename`);
  console.log(`Delete endpoint: http://localhost:${PORT}/delete`);
  console.log(`Ping endpoint: http://localhost:${PORT}/ping`);
});