import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyPrefsToDocument, loadPrefs } from "./lib/prefs";
import "./styles/index.css";

// Apply user comfort prefs (bigger text, high contrast) BEFORE React
// renders so the document never flashes the default theme on slow
// devices. CSS rules scope to data-large-text / data-high-contrast on
// the <html> element.
applyPrefsToDocument(loadPrefs());

const root = document.getElementById("root");
if (!root) {
  throw new Error("Trackfit: #root not found in document");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
