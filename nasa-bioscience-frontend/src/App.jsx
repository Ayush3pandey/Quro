// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./index.css";

import { ProgressProvider } from "./context/ProgressContext"; // <--- adjust path if your file lives elsewhere

import Navigation from "./components/Navigation";
import Dashboard from "./pages/Dashboard";
import Publications from "./pages/Publications";
import ChatBot from "./pages/ChatBot";
import Analytics from "./pages/Analytics";
import ContactUs from "./pages/ContactUs";
import PublicationDetail from "./pages/PublicationDetail";
import Moon from "./pages/Moon";
import Mars from "./pages/Mars";

function App() {
  return (
    <ProgressProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          {/* Navbar fixed on top */}
          <Navigation />

          {/* Push content down by nav height (h-20 = 80px) */}
          <main className="pt-20">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/publications" element={<Publications />} />
              <Route path="/chatbot" element={<ChatBot />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/publication/:pmcid" element={<PublicationDetail />} />
              <Route path="/moon" element={<Moon />} />
              <Route path="/mars" element={<Mars />} />
              <Route path="/contact" element={<ContactUs />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ProgressProvider>
  );
}

export default App;
