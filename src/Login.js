import React, { useEffect } from "react";

function Login({ onLogin }) {
  useEffect(() => {
    const initializeGoogleSignIn = () => {
      window.google.accounts.id.initialize({
        client_id: "704246886275-d8rt38rfesceaqjjlt5lb9736o5lht93.apps.googleusercontent.com",
        callback: handleLogin
      });

      window.google.accounts.id.renderButton(
        document.getElementById("google-login"),
        { theme: "outline", size: "large" }
      );
    };

    const handleLogin = (response) => {
      const userData = {
        credential: response.credential,
        clientId: response.clientId
      };
      try {
        // Decode JWT token
        const parts = response.credential.split('.');
        if (parts.length === 3) {
          const decoded = JSON.parse(atob(parts[1]));
          userData.email = decoded.email;
          userData.userId = decoded.sub || decoded.email;
          console.log("Decoded user:", userData);
        } else {
          userData.userId = Math.random().toString(36).substr(2, 9);
        }
      } catch (e) {
        console.error("JWT decode error:", e);
        userData.userId = Math.random().toString(36).substr(2, 9);
      }
      onLogin(userData);
    };

    if (window.google) {
      initializeGoogleSignIn();
    }
  }, [onLogin]);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: "url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2000')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* Dark overlay for better readability */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.4)",
          zIndex: 1,
        }}
      ></div>

      <div
        style={{
          position: "relative",
          zIndex: 2,
          background: "rgba(255, 255, 255, 0.15)",
          backdropFilter: "blur(10px)",
          borderRadius: "18px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          padding: "40px 32px",
          maxWidth: "420px",
          width: "100%",
          textAlign: "center",
          border: "1px solid rgba(255, 255, 255, 0.2)",
        }}
      >
        <h2 style={{ color: "white", marginBottom: "12px", fontWeight: 700, textShadow: "2px 2px 4px rgba(0, 0, 0, 0.6)" }}>
          Databox (Google Drive)
        </h2>
        <p style={{ color: "white", marginBottom: "12px", fontSize: "18px", textShadow: "1px 1px 3px rgba(0, 0, 0, 0.6)" }}>
          Backup photos & videos to your Google Drive.
        </p>
        <p style={{ color: "#ffd700", marginBottom: "24px", fontSize: "16px", fontWeight: 500, textShadow: "1px 1px 3px rgba(0, 0, 0, 0.6)" }}>
          You must sign in with Google to use Databox.
        </p>
        <div id="google-login" style={{ display: "inline-block" }}></div>
      </div>
    </div>
  );
}

export default Login;