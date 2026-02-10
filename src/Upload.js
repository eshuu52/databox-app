import React, { useRef, useState, useEffect } from "react";
import UploadedFiles from "./UploadedFiles";
import axios from "axios";

function Upload({ user, onLogout }) {
  const fileInputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("images");
  const [serverStatus, setServerStatus] = useState("connecting");

  // Test server connectivity on mount
  useEffect(() => {
    const testServer = async () => {
      try {
        const response = await axios.get("http://localhost:5000/ping", { timeout: 5000 });
        console.log("Server ping successful:", response.data);
        setServerStatus("connected");
      } catch (error) {
        console.error("Server ping failed:", error.message);
        setServerStatus("disconnected");
      }
    };
    testServer();
  }, []);

  // Handle file selection and upload
  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files.length) return;

    if (!user?.userId) {
      alert("Error: User ID not found. Please log in again.");
      return;
    }

    if (serverStatus === "disconnected") {
      alert("Error: Cannot connect to server. Make sure http://localhost:5000 is running");
      return;
    }

    // Prevent non-image files in 'images' category
    if (selectedCategory === "images") {
      const allowed = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
      for (let file of files) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!allowed.includes(ext)) {
          alert("Only image files are allowed in the Images category!\nBlocked: " + file.name);
          return;
        }
      }
    }
    // Prevent non-document files in 'documents' category
    if (selectedCategory === "documents") {
      const allowed = ["pdf", "doc", "docx", "txt", "rtf", "xls", "xlsx", "csv", "ppt", "pptx"];
      for (let file of files) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!allowed.includes(ext)) {
          alert("Only document files are allowed in the Documents category!\nBlocked: " + file.name);
          return;
        }
      }
    }
    // Prevent non-video files in 'videos' category
    if (selectedCategory === "videos") {
      const allowed = ["mp4", "avi", "mov", "wmv", "flv", "mkv", "webm"];
      for (let file of files) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!allowed.includes(ext)) {
          alert("Only video files are allowed in the Videos category!\nBlocked: " + file.name);
          return;
        }
      }
    }

    const formData = new FormData();
    for (let file of files) {
      formData.append("file", file);
    }
    formData.append("folder", selectedCategory);
    formData.append("userId", user.userId);

    console.log("Uploading file - userId:", user.userId, "folder:", selectedCategory);

    setUploading(true);
    try {
      await axios.post("http://localhost:5000/upload", formData, {
        headers: {
          "x-user-id": user.userId,
          "x-folder": selectedCategory
        }
      });
      console.log("Upload successful");
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed: " + error.message);
    }
    setUploading(false);
  };

  return (
    <div style={{ 
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)",
      minHeight: "100vh", 
      padding: "2rem",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Animated background circles */}
      <div style={{
        position: "absolute",
        top: "-10%",
        left: "-5%",
        width: "500px",
        height: "500px",
        background: "rgba(255, 255, 255, 0.1)",
        borderRadius: "50%",
        filter: "blur(80px)",
        animation: "float 20s infinite ease-in-out"
      }}></div>
      <div style={{
        position: "absolute",
        bottom: "-10%",
        right: "-5%",
        width: "600px",
        height: "600px",
        background: "rgba(255, 255, 255, 0.08)",
        borderRadius: "50%",
        filter: "blur(80px)",
        animation: "float 25s infinite ease-in-out reverse"
      }}></div>

      {/* Main content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "2rem",
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(10px)",
          padding: "1.5rem",
          borderRadius: "20px",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)"
        }}>
          <h1 style={{ color: "#fff", margin: 0, fontSize: "2rem", textShadow: "2px 2px 4px rgba(0,0,0,0.2)" }}>
            <span role="img" aria-label="folder">📁</span> Upload files to Databox
          </h1>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <div style={{ 
              fontSize: "0.9rem", 
              padding: "0.75rem 1.25rem", 
              borderRadius: "12px", 
              background: serverStatus === "connected" ? "rgba(76, 175, 80, 0.9)" : "rgba(255, 107, 107, 0.9)",
              color: "white",
              fontWeight: "600",
              boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
            }}>
              {serverStatus === "connected" ? "✓ Server Connected" : serverStatus === "disconnected" ? "✗ Server Offline" : "⟳ Connecting..."}
            </div>
            <button 
              onClick={onLogout} 
              style={{ 
                background: "rgba(255, 68, 68, 0.9)",
                color: "#fff", 
                border: "none", 
                padding: "0.75rem 1.5rem", 
                borderRadius: "12px",
                fontSize: "1rem",
                fontWeight: "600",
                cursor: "pointer",
                boxShadow: "0 4px 15px rgba(255, 68, 68, 0.3)",
                transition: "all 0.3s ease"
              }}
              onMouseOver={(e) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 6px 20px rgba(255, 68, 68, 0.4)";
              }}
              onMouseOut={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 15px rgba(255, 68, 68, 0.3)";
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Category selection */}
        <p style={{ color: "#fff", fontSize: "1.1rem", marginBottom: "1rem", textShadow: "1px 1px 2px rgba(0,0,0,0.2)" }}>
          Select a category and upload your files
        </p>
        <div style={{ marginBottom: "2rem" }}>
          {["images", "videos", "documents"].map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{ 
                background: selectedCategory === cat 
                  ? "rgba(255, 167, 38, 0.95)" 
                  : "rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(10px)",
                color: "#fff", 
                border: selectedCategory === cat ? "2px solid rgba(255, 255, 255, 0.5)" : "1px solid rgba(255, 255, 255, 0.2)",
                padding: "0.75rem 1.5rem", 
                borderRadius: "12px", 
                marginRight: "1rem", 
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: "600",
                textTransform: "capitalize",
                boxShadow: selectedCategory === cat 
                  ? "0 4px 15px rgba(255, 167, 38, 0.3)" 
                  : "0 2px 10px rgba(0,0,0,0.1)",
                transition: "all 0.3s ease"
              }}
              onMouseOver={(e) => {
                e.target.style.transform = "translateY(-2px)";
              }}
              onMouseOut={(e) => {
                e.target.style.transform = "translateY(0)";
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Upload area */}
        <div style={{
          border: "3px dashed rgba(255, 255, 255, 0.4)",
          borderRadius: "20px",
          padding: "3rem",
          textAlign: "center",
          marginBottom: "2rem",
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)"
        }}>
          <span role="img" aria-label="folder" style={{ fontSize: "4rem", marginBottom: "1rem", display: "block" }}>📁</span>
          <p style={{ color: "#fff", fontSize: "1.3rem", fontWeight: "600", marginBottom: "0.5rem", textShadow: "1px 1px 2px rgba(0,0,0,0.2)" }}>
            Drag & Drop files here
          </p>
          <p style={{ color: "rgba(255, 255, 255, 0.9)", marginBottom: "0.5rem" }}>
            Supported formats: .jpg, .jpeg, .png, .gif, .webp, .svg
          </p>
          <p style={{ color: "rgba(255, 255, 255, 0.9)", marginBottom: "1.5rem" }}>
            Maximum file size: 10 MB
          </p>
          <input
            type="file"
            multiple
            style={{ display: "none" }}
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button
            style={{ 
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "#fff", 
              border: "none", 
              padding: "1rem 2.5rem", 
              borderRadius: "12px",
              fontSize: "1.1rem",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
              transition: "all 0.3s ease"
            }}
            onClick={() => fileInputRef.current.click()}
            disabled={uploading}
            onMouseOver={(e) => {
              e.target.style.transform = "translateY(-3px)";
              e.target.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.5)";
            }}
            onMouseOut={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
            }}
          >
            {uploading ? "Uploading..." : "Choose Files"}
          </button>
        </div>

        {/* Uploaded files section */}
        <div style={{
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(10px)",
          padding: "2rem",
          borderRadius: "20px",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)"
        }}>
          <UploadedFiles user={user} refreshKey={refreshKey} setRefreshKey={setRefreshKey} />
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(30px, -30px) rotate(120deg);
          }
          66% {
            transform: translate(-20px, 20px) rotate(240deg);
          }
        }
      `}</style>
    </div>
  );
}

export default Upload;