import React, { useEffect, useState } from "react";
import axios from "axios";

// ✅ Netlify CI-safe icon imports
import { FcImageFile, FcVideoFile, FcFile } from "react-icons/fc";
import {
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFilePowerpoint,
  FaFileArchive,
  FaFileAudio,
  FaFileCode,
  FaFileAlt,
  FaFile
} from "react-icons/fa";

const BACKEND_URL = "https://databox-app.onrender.com";

function UploadedFiles({ user, refreshKey, setRefreshKey }) {
  const [files, setFiles] = useState({
    images: [],
    videos: [],
    documents: []
  });
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    if (!user || !user.userId) {
      setError("No user logged in");
      return;
    }

    const categories = ["images", "videos", "documents"];

    Promise.all(
      categories.map(cat =>
        axios
          .get(`${BACKEND_URL}/files/${user.userId}/${cat}`)
          .then(res => ({ cat, files: res.data }))
          .catch(() => ({ cat, files: [] }))
      )
    )
      .then(results => {
        const data = {};
        results.forEach(({ cat, files }) => {
          data[cat] = files;
        });
        setFiles(data);
        setError(null);
      })
      .catch(err => {
        setError(err.message);
      });
  }, [user, refreshKey]);

  // ---------- ICON HELPER ----------
  const getFileIcon = filename => {
    const ext = filename.split(".").pop().toLowerCase();
    const style = { marginRight: 12, fontSize: 24 };

    if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(ext))
      return <FcImageFile style={style} />;

    if (["mp4", "avi", "mov", "wmv", "flv", "mkv", "webm"].includes(ext))
      return <FcVideoFile style={style} />;

    if (ext === "pdf") return <FaFilePdf style={{ ...style, color: "#e74c3c" }} />;
    if (["doc", "docx", "rtf"].includes(ext))
      return <FaFileWord style={{ ...style, color: "#185abd" }} />;
    if (["xls", "xlsx", "csv"].includes(ext))
      return <FaFileExcel style={{ ...style, color: "#21a366" }} />;
    if (["ppt", "pptx"].includes(ext))
      return <FaFilePowerpoint style={{ ...style, color: "#d24726" }} />;
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext))
      return <FaFileArchive style={{ ...style, color: "#f1c40f" }} />;
    if (["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext))
      return <FaFileAudio style={{ ...style, color: "#9b59b6" }} />;
    if (["js", "jsx", "ts", "tsx", "json", "html", "css", "py", "java", "c", "cpp", "cs", "php"].includes(ext))
      return <FaFileCode style={{ ...style, color: "#2980b9" }} />;
    if (["txt", "md", "log"].includes(ext))
      return <FaFileAlt style={{ ...style, color: "#34495e" }} />;
    if (["conf", "ini", "cfg", "env"].includes(ext))
      return <FcFile style={style} />;

    return <FaFile style={{ ...style, color: "#888" }} />;
  };

  // ---------- RENAME ----------
  const [renaming, setRenaming] = useState({});
  const [newName, setNewName] = useState("");

  const handleRenameSubmit = async (cat, oldName) => {
    if (!newName || newName === oldName) return setRenaming({});

    const ext = oldName.includes(".")
      ? oldName.substring(oldName.lastIndexOf("."))
      : "";

    const finalName = newName.endsWith(ext)
      ? newName
      : newName.replace(/\.[^.]+$/, "") + ext;

    try {
      await axios.post("http://localhost:5000/rename", {
        userId: user.userId,
        category: cat,
        oldName,
        newName: finalName
      });

      setRenaming({});
      setNewName("");
      setRefreshKey?.(prev => prev + 1);
    } catch (err) {
      alert("Rename failed: " + err.message);
    }
  };

  // ---------- DELETE ----------
  const handleDelete = async (cat, fileName) => {
    // Confirm before deleting
    const confirmDelete = window.confirm(`Are you sure you want to delete "${fileName}"?`);
    if (!confirmDelete) return;

    try {
      await axios.post(`${BACKEND_URL}/delete`, {
        userId: user.userId,
        category: cat,
        fileName: fileName
      });

      // Refresh file list
      setRefreshKey?.(prev => prev + 1);
      
      alert("File deleted successfully!");
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  // ---------- UI ----------
  return (
    <div>
      <h3 style={{ color: "#fff" }}>
        Uploaded Files (
        {Object.values(files).reduce((t, a) => t + a.length, 0)})
      </h3>

      <div style={{ marginBottom: 16 }}>
        {["all", "images", "videos", "documents"].map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              background: selectedCategory === cat ? "#ffa726" : "rgba(255, 255, 255, 0.15)",
              color: "#fff",
              border: selectedCategory === cat ? "2px solid rgba(255, 255, 255, 0.5)" : "1px solid rgba(255, 255, 255, 0.2)",
              padding: "8px 14px",
              borderRadius: 8,
              marginRight: 10,
              cursor: "pointer",
              fontWeight: "600",
              textTransform: "uppercase",
              fontSize: "0.85rem"
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {(selectedCategory === "all"
          ? ["images", "videos", "documents"].flatMap(cat =>
              files[cat].map(file => ({ cat, file }))
            )
          : files[selectedCategory].map(file => ({
              cat: selectedCategory,
              file
            }))
        ).map(({ cat, file }) => (
          <li 
            key={cat + file} 
            style={{ 
              display: "flex", 
              alignItems: "center",
              gap: 10, 
              marginBottom: 12,
              background: "rgba(255, 255, 255, 0.08)",
              padding: "10px 15px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)"
            }}
          >
            {getFileIcon(file)}
            {renaming.file === file ? (
              <>
                <input 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                    background: "rgba(255, 255, 255, 0.1)",
                    color: "#fff",
                    fontSize: "14px"
                  }}
                />
                <button 
                  onClick={() => handleRenameSubmit(cat, file)}
                  style={{
                    background: "#4CAF50",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "12px"
                  }}
                >
                  Save
                </button>
                <button 
                  onClick={() => setRenaming({})}
                  style={{
                    background: "#757575",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "12px"
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <a
                  href={`${BACKEND_URL}/uploads/${user.userId}/${cat}/${file}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 1,
                    color: "#fff",
                    textDecoration: "none",
                    fontWeight: "500"
                  }}
                >
                  {file}
                </a>
                <button 
                  onClick={() => {
                    setRenaming({ cat, file });
                    setNewName(file);
                  }}
                  style={{
                    background: "#2196F3",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "12px"
                  }}
                >
                  Rename
                </button>
                <button 
                  onClick={() => handleDelete(cat, file)}
                  style={{
                    background: "#f44336",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "12px"
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UploadedFiles;