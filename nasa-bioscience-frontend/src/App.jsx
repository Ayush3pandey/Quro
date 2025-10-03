import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./index.css";


import Navigation from "./components/Navigation";
import Dashboard from "./pages/Dashboard";
import Publications from "./pages/Publications";
import ChatBot from "./pages/ChatBot";
import Analytics from "./pages/Analytics";
import PublicationDetail from "./pages/PublicationDetail";
import Moon from './pages/Moon';
import Mars from './pages/Mars';

function App() {
  return (
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
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
