import React, { useEffect, useState } from "react";
import axios from "axios";
import { FcImageFile, FcVideoFile, FcFolder } from "react-icons/fc";
import {
  FaFilePdf, FaFileWord, FaFileExcel, FaFilePowerpoint, FaFileArchive,
  FaFileAudio, FaFileCode, FaFileAlt, FaFile, FaEye, FaDownload, FaTimes,
  FaFolderPlus, FaChevronRight, FaHome, FaEdit, FaTrash
} from "react-icons/fa";

const BACKEND_URL = window.location.hostname === "localhost"
  ? "http://localhost:5000"
  : "https://databox-app.onrender.com";

const isImage = (f) => ["jpg","jpeg","png","gif","bmp","webp","svg"].includes(f.split('.').pop().toLowerCase());
const isPdf = (f) => f.split('.').pop().toLowerCase() === "pdf";
const isVideo = (f) => ["mp4","webm","ogg","mov"].includes(f.split('.').pop().toLowerCase());
const isText = (f) => {
  const ext = f.split('.').pop().toLowerCase();
  return ["txt","md","json","xml","csv","conf","config","ini","log","yml","yaml",
          "sh","bat","env","js","py","html","css","ts","jsx","tsx","sql","toml"].includes(ext);
};
const canPreview = (f) => isImage(f) || isPdf(f) || isVideo(f) || isText(f);

function UploadedFiles({ user, refreshKey, setRefreshKey, selectedCategory, currentPath, setCurrentPath }) {
  const [items, setItems] = useState({ folders: [], files: [] });
  const [error, setError] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewContent, setPreviewContent] = useState(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renaming, setRenaming] = useState(null);
  const [newName, setNewName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user?.userId || !selectedCategory) return;
    const pathParam = currentPath || "";
    axios.get(`${BACKEND_URL}/browse/${user.userId}/${selectedCategory}?path=${encodeURIComponent(pathParam)}`)
      .then(res => { setItems(res.data); setError(null); })
      .catch(err => { console.error("Browse error:", err); setError(err.message); });
  }, [user, selectedCategory, currentPath, refreshKey]);

  const openFolder = (folderName) => {
    setCurrentPath(currentPath ? `${currentPath}/${folderName}` : folderName);
  };

  const goBack = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  const navigateTo = (index) => {
    if (index === -1) setCurrentPath("");
    else {
      const parts = currentPath.split('/');
      setCurrentPath(parts.slice(0, index + 1).join('/'));
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await axios.post(`${BACKEND_URL}/create-folder`, {
        userId: user.userId, category: selectedCategory,
        path: currentPath, folderName: newFolderName
      });
      setNewFolderName(""); setCreatingFolder(false);
      setRefreshKey(prev => prev + 1);
    } catch (err) { alert(err.response?.data?.message || "Failed to create folder"); }
  };

  const handleRename = async (oldName, isFolder) => {
    if (!newName || newName === oldName) { setRenaming(null); return; }
    let finalName = newName;
    if (!isFolder && oldName.includes(".")) {
      const ext = oldName.substring(oldName.lastIndexOf("."));
      if (!newName.endsWith(ext)) finalName = newName.replace(/\.[^.]+$/, "") + ext;
    }
    try {
      await axios.post(`${BACKEND_URL}/rename`, {
        userId: user.userId, category: selectedCategory,
        path: currentPath, oldName, newName: finalName, isFolder
      });
      setRenaming(null); setNewName("");
      setRefreshKey(prev => prev + 1);
    } catch (err) { alert(err.response?.data?.message || "Failed to rename"); }
  };

  const handleDelete = async (name, isFolder) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await axios.post(`${BACKEND_URL}/delete`, {
        userId: user.userId, category: selectedCategory,
        path: currentPath, fileName: name, isFolder
      });
      setRefreshKey(prev => prev + 1);
    } catch (err) { alert(err.response?.data?.message || "Failed to delete"); }
  };

  const handlePreview = async (fileName) => {
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
    const fileUrl = `${BACKEND_URL}/uploads/${user.userId}/${selectedCategory}/${filePath}`;
    setPreviewContent(null);
    setPreviewFile({ fileName, fileUrl, filePath });

    if (isText(fileName)) {
      try {
        const res = await axios.get(`${BACKEND_URL}/preview/${user.userId}/${selectedCategory}?file=${encodeURIComponent(filePath)}`);
        setPreviewContent(res.data.content);
      } catch (e) {
        setPreviewContent("Could not load file content.");
      }
    }
  };

  const handleDownload = async (fileName) => {
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
    const downloadUrl = `${BACKEND_URL}/download/${user.userId}/${selectedCategory}?file=${encodeURIComponent(filePath)}`;
    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch (err) { alert("Download failed: " + err.message); }
  };

  const getFileIcon = filename => {
    const ext = filename.split(".").pop().toLowerCase();
    const style = { fontSize: "2.5rem", marginBottom: "0.5rem" };
    if (["jpg","jpeg","png","gif","bmp","webp","svg"].includes(ext)) return <FcImageFile style={style} />;
    if (["mp4","avi","mov","wmv","flv","mkv","webm"].includes(ext)) return <FcVideoFile style={style} />;
    if (ext === "pdf") return <FaFilePdf style={{ ...style, color: "#e74c3c" }} />;
    if (["doc","docx"].includes(ext)) return <FaFileWord style={{ ...style, color: "#185abd" }} />;
    if (["xls","xlsx"].includes(ext)) return <FaFileExcel style={{ ...style, color: "#21a366" }} />;
    if (["ppt","pptx"].includes(ext)) return <FaFilePowerpoint style={{ ...style, color: "#d24726" }} />;
    if (["zip","rar","7z"].includes(ext)) return <FaFileArchive style={{ ...style, color: "#f1c40f" }} />;
    if (["mp3","wav"].includes(ext)) return <FaFileAudio style={{ ...style, color: "#9b59b6" }} />;
    if (["js","py","html","css","ts","sh","jsx","tsx"].includes(ext)) return <FaFileCode style={{ ...style, color: "#2980b9" }} />;
    if (["txt","md","log","conf","ini","yml","yaml","json","xml","env","config"].includes(ext)) return <FaFileAlt style={{ ...style, color: "#27ae60" }} />;
    return <FaFile style={{ ...style, color: "#888" }} />;
  };

  const filteredFolders = items.folders.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFiles = items.files.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
  const breadcrumbs = currentPath ? currentPath.split('/') : [];
  const totalItems = items.folders.length + items.files.length;
  const filteredTotal = filteredFolders.length + filteredFiles.length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", color: "#fff", marginBottom: "1rem",
        background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "8px", fontSize: "0.95rem" }}>
        <FaHome style={{ marginRight: "5px" }} />
        <span onClick={() => navigateTo(-1)} style={{ cursor: "pointer", fontWeight: currentPath ? "normal" : "bold" }}>
          {selectedCategory}
        </span>
        {breadcrumbs.map((part, index) => (
          <React.Fragment key={index}>
            <FaChevronRight style={{ margin: "0 8px", fontSize: "0.7rem" }} />
            <span onClick={() => navigateTo(index)}
              style={{ cursor: "pointer", fontWeight: index === breadcrumbs.length - 1 ? "bold" : "normal" }}>
              {part}
            </span>
          </React.Fragment>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {currentPath && (
          <button onClick={goBack} style={{ background: "rgba(255,255,255,0.15)", color: "#fff",
            border: "1px solid rgba(255,255,255,0.3)", padding: "8px 16px", borderRadius: "6px",
            cursor: "pointer", fontWeight: "600", fontSize: "0.9rem" }}>← Back</button>
        )}
        <button onClick={() => setCreatingFolder(true)} style={{ background: "#4CAF50", color: "#fff",
          border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "600",
          fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px" }}>
          <FaFolderPlus /> New Folder
        </button>
        <div style={{ flex: 1, color: "#fff", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          {searchQuery ? `${filteredTotal} of ${totalItems}` : `${totalItems}`} item{totalItems !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ marginBottom: "1rem", position: "relative" }}>
        <input type="text" placeholder="🔍 Search files and folders..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: "100%", padding: "10px 40px 10px 14px", borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)",
            color: "#fff", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }} />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} style={{
            position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "16px"
          }}>✕</button>
        )}
      </div>

      {creatingFolder && (
        <div style={{ background: "rgba(76,175,80,0.2)", border: "2px solid #4CAF50",
          padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}>
          <input type="text" placeholder="Folder name..." value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
            style={{ width: "100%", padding: "8px", borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)",
              color: "#fff", marginBottom: "0.5rem" }} autoFocus />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={handleCreateFolder} style={{ background: "#4CAF50", color: "#fff",
              border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Create</button>
            <button onClick={() => { setCreatingFolder(false); setNewFolderName(""); }} style={{
              background: "#757575", color: "#fff", border: "none", padding: "6px 12px",
              borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
          </div>
        </div>
      )}

      {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1rem" }}>
        {filteredFolders.map(folder => (
          <div key={folder} style={{ background: "rgba(255,255,255,0.1)", padding: "1rem",
            borderRadius: "10px", textAlign: "center", cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.2)", transition: "all 0.3s" }}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
            onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}>
            {renaming === folder ? (
              <>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleRename(folder, true)}
                  style={{ width: "100%", padding: "4px", marginBottom: "8px", borderRadius: "4px",
                    border: "1px solid #fff", background: "rgba(255,255,255,0.1)", color: "#fff" }} autoFocus />
                <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                  <button onClick={() => handleRename(folder, true)} style={{ padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}>Save</button>
                  <button onClick={() => setRenaming(null)} style={{ padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div onClick={() => openFolder(folder)}>
                  <FcFolder style={{ fontSize: "3rem", marginBottom: "0.5rem" }} />
                  <p style={{ color: "#fff", margin: "0.5rem 0", wordBreak: "break-word", fontSize: "0.9rem" }}>{folder}</p>
                </div>
                <div style={{ display: "flex", gap: "0.25rem", justifyContent: "center", marginTop: "0.5rem" }}>
                  <button onClick={(e) => { e.stopPropagation(); setRenaming(folder); setNewName(folder); }} style={{
                    background: "#2196F3", color: "#fff", border: "none", padding: "4px 6px", borderRadius: "4px", cursor: "pointer", fontSize: "11px"
                  }}><FaEdit /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(folder, true); }} style={{
                    background: "#f44336", color: "#fff", border: "none", padding: "4px 6px", borderRadius: "4px", cursor: "pointer", fontSize: "11px"
                  }}><FaTrash /></button>
                </div>
              </>
            )}
          </div>
        ))}

        {filteredFiles.map(file => (
          <div key={file} style={{ background: "rgba(255,255,255,0.1)", padding: "1rem",
            borderRadius: "10px", textAlign: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
            {getFileIcon(file)}
            {renaming === file ? (
              <>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleRename(file, false)}
                  style={{ width: "100%", padding: "4px", marginBottom: "6px", borderRadius: "4px",
                    border: "1px solid #fff", background: "rgba(255,255,255,0.1)", color: "#fff",
                    fontSize: "0.8rem", textAlign: "center" }} autoFocus />
                <div style={{ display: "flex", gap: "4px", justifyContent: "center", marginBottom: "4px" }}>
                  <button onClick={() => handleRename(file, false)} style={{
                    background: "#4CAF50", color: "#fff", border: "none", padding: "3px 8px",
                    borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>Save</button>
                  <button onClick={() => setRenaming(null)} style={{
                    background: "#757575", color: "#fff", border: "none", padding: "3px 8px",
                    borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>Cancel</button>
                </div>
              </>
            ) : (
              <p style={{ color: "#fff", margin: "0.5rem 0", wordBreak: "break-word", fontSize: "0.85rem" }}>{file}</p>
            )}
            <div style={{ display: "flex", gap: "0.25rem", justifyContent: "center", flexWrap: "wrap" }}>
              {canPreview(file) && (
                <button onClick={() => handlePreview(file)} style={{
                  background: "#9C27B0", color: "#fff", border: "none", padding: "4px 6px", borderRadius: "4px", cursor: "pointer", fontSize: "11px"
                }}><FaEye /></button>
              )}
              <button onClick={() => handleDownload(file)} style={{
                background: "#4CAF50", color: "#fff", border: "none", padding: "4px 6px", borderRadius: "4px", cursor: "pointer", fontSize: "11px"
              }}><FaDownload /></button>
              <button onClick={() => { setRenaming(file); setNewName(file.substring(0, file.lastIndexOf('.')) || file); }} style={{
                background: "#2196F3", color: "#fff", border: "none", padding: "4px 6px", borderRadius: "4px", cursor: "pointer", fontSize: "11px"
              }}><FaEdit /></button>
              <button onClick={() => handleDelete(file, false)} style={{
                background: "#f44336", color: "#fff", border: "none", padding: "4px 6px", borderRadius: "4px", cursor: "pointer", fontSize: "11px"
              }}><FaTrash /></button>
            </div>
          </div>
        ))}
      </div>

      {totalItems === 0 && (
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.7)", padding: "3rem" }}>
          <p>This folder is empty</p>
          <p style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>Click "New Folder" to create folders or upload files!</p>
        </div>
      )}

      {previewFile && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.95)", zIndex: 9999, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: "2rem" }}
          onClick={() => { setPreviewFile(null); setPreviewContent(null); }}>
          <button onClick={() => { setPreviewFile(null); setPreviewContent(null); }} style={{
            position: "absolute", top: "20px", right: "20px", background: "rgba(255,255,255,0.2)",
            border: "none", color: "#fff", fontSize: "30px", cursor: "pointer", borderRadius: "50%",
            width: "50px", height: "50px" }}><FaTimes /></button>
          <h2 style={{ color: "#fff", marginBottom: "1rem", fontSize: "1rem" }}>{previewFile.fileName}</h2>

          <div style={{ maxWidth: "90%", width: "800px", maxHeight: "70vh", marginBottom: "1rem",
            overflow: "auto" }} onClick={(e) => e.stopPropagation()}>

            {isImage(previewFile.fileName) && (
              <img src={previewFile.fileUrl} alt={previewFile.fileName}
                style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: "10px" }} />
            )}

            {isPdf(previewFile.fileName) && (
              <iframe src={previewFile.fileUrl} style={{ width: "100%", height: "65vh", border: "none", borderRadius: "10px" }} title="PDF" />
            )}

            {isVideo(previewFile.fileName) && (
              <video controls style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: "10px" }}>
                <source src={previewFile.fileUrl} />
              </video>
            )}

            {isText(previewFile.fileName) && (
              <pre style={{
                background: "rgba(255,255,255,0.05)", color: "#e0e0e0", padding: "1.5rem",
                borderRadius: "10px", fontSize: "0.85rem", whiteSpace: "pre-wrap",
                wordBreak: "break-word", textAlign: "left", maxHeight: "65vh",
                overflow: "auto", border: "1px solid rgba(255,255,255,0.1)"
              }}>
                {previewContent !== null ? previewContent : "Loading..."}
              </pre>
            )}
          </div>

          <button onClick={(e) => { e.stopPropagation(); handleDownload(previewFile.fileName); }} style={{
            background: "#4CAF50", color: "#fff", padding: "12px 24px", borderRadius: "8px", border: "none",
            cursor: "pointer", fontWeight: "600", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px"
          }}><FaDownload /> Download</button>
        </div>
      )}
    </div>
  );
}

export default UploadedFiles;