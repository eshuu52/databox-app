import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './App.css';

const CLIENT_ID = "704246886275-d8rt38rfesceaqjjlt5lb9736o5lht93.apps.googleusercontent.com"; // <- your client id

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <GoogleOAuthProvider clientId={CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
);
