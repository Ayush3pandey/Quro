

// src/pages/Analytics.jsx
import React from "react";
import GraphFlow from "../components/GraphFlow";

export default function Analytics() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Analytics — Graph Explorer</h1>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
        <GraphFlow />
      </div>
    </div>
  );
}
