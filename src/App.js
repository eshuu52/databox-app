// src/App.js
// import UploadedFiles from './UploadedFiles';
import React, { useState, useEffect } from "react";
import Login from "./Login";
import Upload from "./Upload_RENDER";

function App() {
  const [user, setUser] = useState(null);

  // Check localStorage to persist login
  useEffect(() => {
    // Always clear localStorage on app load to force login page
    localStorage.removeItem("databox_user");
    setUser(null);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("databox_user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("databox_user");
  };

  return (
    <div>
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Upload user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
