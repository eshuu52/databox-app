import React, { useRef, useState, useEffect, useCallback } from "react";
import UploadedFiles from "./UploadedFiles";
import axios from "axios";

const BACKEND_URL = window.location.hostname === "localhost"
  ? "http://localhost:5000"
  : "https://databox-app.onrender.com";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function Upload({ user, onLogout }) {
  const fileInputRef = useRef();
  const folderInputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("images");
  const [serverStatus, setServerStatus] = useState("connecting");
  const [currentPath, setCurrentPath] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [storageInfo, setStorageInfo] = useState(null);

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
      folderInputRef.current.setAttribute("mozdirectory", "");
    }
  }, []);

  const fetchStorage = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const res = await axios.get(`${BACKEND_URL}/storage/${user.userId}`);
      setStorageInfo(res.data);
    } catch (err) {
      console.log("Storage fetch failed:", err.message);
    }
  }, [user?.userId]);

  useEffect(() => {
    const testServer = async () => {
      try {
        await axios.get(`${BACKEND_URL}/ping`, { timeout: 15000 });
        setServerStatus("connected");
        fetchStorage();
      } catch (error) {
        setServerStatus("disconnected");
      }
    };
    testServer();
    const interval = setInterval(() => {
      if (serverStatus !== "connected") testServer();
    }, 10000);
    return () => clearInterval(interval);
  }, [serverStatus, fetchStorage]);

  useEffect(() => {
    if (refreshKey > 0) fetchStorage();
  }, [refreshKey, fetchStorage]);

  const uploadFiles = async (fileEntries) => {
    if (!user?.userId) { alert("Error: Please log in again."); return; }
    if (serverStatus === "disconnected") { alert("Server offline. Please wait..."); return; }
    if (fileEntries.length === 0) { alert("No files found to upload!"); return; }

    setUploading(true);
    setUploadProgress({ current: 0, total: fileEntries.length });

    let uploaded = 0;
    let skipped = 0;
    let failed = 0;

    for (const entry of fileEntries) {
      const { file, relativePath } = entry;

      if (file.name.startsWith('.') || file.name === 'Thumbs.db' || file.size === 0) {
        skipped++;
        setUploadProgress(p => ({ ...p, current: p.current + 1 }));
        continue;
      }

      let folderPath = selectedCategory;
      if (currentPath) folderPath += `/${currentPath}`;
      if (relativePath) {
        const parts = relativePath.replace(/\\/g, '/').split('/');
        parts.pop();
        if (parts.length > 0 && parts[0] !== '') {
          folderPath += `/${parts.join('/')}`;
        }
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folderPath);
      formData.append("userId", user.userId);

      try {
        await axios.post(`${BACKEND_URL}/upload`, formData, {
          headers: { "x-user-id": user.userId, "x-folder": folderPath }
        });
        uploaded++;
      } catch (err) {
        failed++;
      }
      setUploadProgress(p => ({ ...p, current: p.current + 1 }));
    }

    setUploading(false);
    setUploadProgress({ current: 0, total: 0 });
    setRefreshKey(prev => prev + 1);

    let msg = `✅ ${uploaded} files uploaded!`;
    if (skipped > 0) msg += `\n⚠️ ${skipped} skipped (hidden/system files)`;
    if (failed > 0) msg += `\n❌ ${failed} failed`;
    if (skipped > 0 || failed > 0) alert(msg);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const entries = files.map(f => ({
      file: f,
      relativePath: f.webkitRelativePath || f.name
    }));
    await uploadFiles(entries);
    e.target.value = "";
  };

  const readDroppedItems = (dataTransfer) => {
    return new Promise(async (resolve) => {
      const fileEntries = [];
      const readEntry = (entry, pathSoFar = "") => {
        return new Promise((res) => {
          if (entry.isFile) {
            entry.file((file) => {
              fileEntries.push({ file, relativePath: pathSoFar ? `${pathSoFar}/${file.name}` : file.name });
              res();
            }, () => res());
          } else if (entry.isDirectory) {
            const dirPath = pathSoFar ? `${pathSoFar}/${entry.name}` : entry.name;
            const reader = entry.createReader();
            const readBatch = () => {
              reader.readEntries(async (entries) => {
                if (entries.length === 0) { res(); return; }
                await Promise.all(entries.map(e => readEntry(e, dirPath)));
                readBatch();
              }, () => res());
            };
            readBatch();
          } else { res(); }
        });
      };
      const items = Array.from(dataTransfer.items);
      const entries = items.map(item => item.webkitGetAsEntry?.()).filter(Boolean);
      await Promise.all(entries.map(e => readEntry(e)));
      resolve(fileEntries);
    });
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); };
  const handleDrop = async (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    const fileEntries = await readDroppedItems(e.dataTransfer);
    if (fileEntries.length > 0) await uploadFiles(fileEntries);
  };

  useEffect(() => { setCurrentPath(""); }, [selectedCategory]);

  const categoryColors = { images: "#FF9800", videos: "#9C27B0", documents: "#2196F3" };

  return (
    <div style={{
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)",
      minHeight: "100vh", padding: "2rem", position: "relative", overflow: "hidden"
    }}>
      <div style={{ position: "absolute", top: "-10%", left: "-5%", width: "500px", height: "500px",
        background: "rgba(255,255,255,0.1)", borderRadius: "50%", filter: "blur(80px)",
        animation: "float 20s infinite ease-in-out" }}></div>
      <div style={{ position: "absolute", bottom: "-10%", right: "-5%", width: "600px", height: "600px",
        background: "rgba(255,255,255,0.08)", borderRadius: "50%", filter: "blur(80px)",
        animation: "float 25s infinite ease-in-out reverse" }}></div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "2rem", background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)",
          padding: "1.5rem", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.2)" }}>
          <h1 style={{ color: "#fff", margin: 0, fontSize: "2rem" }}>📁 Upload files to Databox</h1>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            {storageInfo && (() => {
              const LIMIT = 15 * 1024 * 1024 * 1024;
              const usedPct = Math.min((storageInfo.total / LIMIT) * 100, 100);
              const barColor = usedPct > 90 ? "#f44336" : usedPct > 70 ? "#FF9800" : "#4CAF50";
              const freeBytes = LIMIT - storageInfo.total;
              return (
                <div style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(10px)",
                  padding: "0.6rem 1rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.2)",
                  minWidth: "195px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.72rem", fontWeight: "700" }}>💾 STORAGE</span>
                    <span style={{ color: "#fff", fontSize: "0.72rem", fontWeight: "700" }}>
                      {formatBytes(storageInfo.total)} / 15 GB
                    </span>
                  </div>
                  <div style={{ height: "7px", borderRadius: "4px", overflow: "hidden", background: "rgba(255,255,255,0.15)", marginBottom: "4px" }}>
                    <div style={{ width: `${usedPct}%`, height: "100%", background: barColor, borderRadius: "4px", transition: "width 0.5s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.63rem" }}>{usedPct.toFixed(1)}% used</span>
                    <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.63rem" }}>{formatBytes(freeBytes)} free</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {["images", "videos", "documents"].map(cat => (
                      <span key={cat} style={{ color: categoryColors[cat], fontSize: "0.63rem", fontWeight: "600" }}>
                        {cat.charAt(0).toUpperCase()}: {formatBytes(storageInfo.byCategory?.[cat] || 0)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div style={{ fontSize: "0.9rem", padding: "0.75rem 1.25rem", borderRadius: "12px",
              background: serverStatus === "connected" ? "rgba(76,175,80,0.9)" : "rgba(255,107,107,0.9)",
              color: "white", fontWeight: "600" }}>
              {serverStatus === "connected" ? "✓ Connected" : "✗ Offline"}
            </div>
            <button onClick={onLogout} style={{ background: "rgba(255,68,68,0.9)", color: "#fff",
              border: "none", padding: "0.75rem 1.5rem", borderRadius: "12px",
              fontSize: "1rem", fontWeight: "600", cursor: "pointer" }}>Logout</button>
          </div>
        </div>

        <p style={{ color: "#fff", fontSize: "1.1rem", marginBottom: "1rem" }}>
          Select a category and upload your files
        </p>
        <div style={{ marginBottom: "2rem" }}>
          {["images", "videos", "documents"].map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
              background: selectedCategory === cat ? "rgba(255,167,38,0.95)" : "rgba(255,255,255,0.15)",
              color: "#fff",
              border: selectedCategory === cat ? "2px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.2)",
              padding: "0.75rem 1.5rem", borderRadius: "12px", marginRight: "1rem",
              cursor: "pointer", fontSize: "1rem", fontWeight: "600", textTransform: "capitalize"
            }}>{cat}</button>
          ))}
        </div>

        <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          style={{ border: `3px dashed ${isDragOver ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)"}`,
            borderRadius: "20px", padding: "3rem", textAlign: "center", marginBottom: "2rem",
            background: isDragOver ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)", transition: "all 0.2s" }}>
          <span style={{ fontSize: "4rem", marginBottom: "1rem", display: "block" }}>
            {isDragOver ? "📂" : "📁"}
          </span>
          <p style={{ color: "#fff", fontSize: "1.3rem", fontWeight: "600", marginBottom: "0.5rem" }}>
            {isDragOver ? "Drop files or folders here!" : "Drag & Drop files or folders here"}
          </p>
          <p style={{ color: "rgba(255,255,255,0.9)", marginBottom: "0.25rem" }}>
            Uploading to: <strong>{selectedCategory}</strong>{currentPath ? ` > ${currentPath}` : ""}
          </p>
          <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "1.5rem", fontSize: "0.85rem" }}>
            ✅ All file types accepted — upload anything!
          </p>

          {uploading && (
            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ color: "#fff", fontWeight: "600", marginBottom: "0.5rem" }}>
                Uploading {uploadProgress.current} / {uploadProgress.total} files...
              </p>
              <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: "10px", height: "10px", overflow: "hidden" }}>
                <div style={{ background: "linear-gradient(90deg, #4CAF50, #8BC34A)", height: "100%",
                  borderRadius: "10px",
                  width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%`,
                  transition: "width 0.3s" }}></div>
              </div>
            </div>
          )}

          <input type="file" multiple style={{ display: "none" }} ref={fileInputRef} onChange={handleFileChange} />
          <input type="file" multiple style={{ display: "none" }} ref={folderInputRef} onChange={handleFileChange} />

          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => fileInputRef.current.click()} disabled={uploading} style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff",
              border: "none", padding: "1rem 2rem", borderRadius: "12px", fontSize: "1rem",
              fontWeight: "600", cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.7 : 1
            }}>📄 Choose Files</button>
            <button onClick={() => folderInputRef.current.click()} disabled={uploading} style={{
              background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", color: "#fff",
              border: "none", padding: "1rem 2rem", borderRadius: "12px", fontSize: "1rem",
              fontWeight: "600", cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.7 : 1
            }}>📁 Upload Folder</button>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)",
          padding: "2rem", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.2)" }}>
          <UploadedFiles
            user={user} refreshKey={refreshKey} setRefreshKey={setRefreshKey}
            selectedCategory={selectedCategory} currentPath={currentPath} setCurrentPath={setCurrentPath}
          />
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -30px) rotate(120deg); }
          66% { transform: translate(-20px, 20px) rotate(240deg); }
        }
      `}</style>
    </div>
  );
}

export default Upload;