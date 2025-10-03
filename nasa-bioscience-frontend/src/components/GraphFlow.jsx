// src/components/GraphFlow.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
} from "react-flow-renderer";
import api from "../services/api";
import "react-flow-renderer/dist/style.css";

function gridPosition(index, cols = 6, cell = { w: 180, h: 120 }, margin = { x: 80, y: 80 }) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = margin.x + col * cell.w;
  const y = margin.y + row * cell.h;
  return { x, y };
}

export default function GraphFlow() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // dynamic per-label limits: will be updated after graph loads
  const [labelFilters, setLabelFilters] = useState({
    Disease: { enabled: true, limit: 0 },
    Species: { enabled: true, limit: 0 },
    Gene: { enabled: true, limit: 0 },
    Chemical: { enabled: true, limit: 0 },
    Pathway: { enabled: true, limit: 0 },
    SpaceEnvironmentFactor: { enabled: true, limit: 0 },
  });

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const nodesRef = useRef(new Map());
  const edgesRef = useRef(new Map());
  const rfInstanceRef = useRef(null);

  // compute current counts per label from nodesRef
  const getCounts = useCallback(() => {
    const grouped = {};
    nodesRef.current.forEach((meta) => {
      const label = meta?.data?.props?.__label || meta?.data?.label || "";
      grouped[label] = (grouped[label] || 0) + 1;
    });
    return grouped;
  }, []);

  const mergeGraph = useCallback(
    (json) => {
      const incoming = json || { nodes: [], links: [] };
      const incomingNodes = Array.isArray(incoming.nodes) ? incoming.nodes : [];
      const incomingLinks = Array.isArray(incoming.links) ? incoming.links : [];

      const newNodesArr = [];
      incomingNodes.forEach((n) => {
        const id = String(n.id);
        const name = n.name || n.paper_title || n.label || id;
        if (!nodesRef.current.has(id)) {
          const totalExisting = nodesRef.current.size + newNodesArr.length;
          const cols = Math.max(4, Math.round(Math.sqrt(Math.max(1, totalExisting + incomingNodes.length))));
          const pos = gridPosition(totalExisting, cols);

          const data = { label: name, props: n.props || {} };
          data.props.__label = n.label || "";

          const nodeObj = {
            id,
            position: pos,
            data,
            draggable: true,
            selectable: true,
            style: {
              border: "2px solid #e2e8f0",
              padding: 14,
              borderRadius: 10,
              background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
              minWidth: 140,
              fontSize: "14px",
              fontWeight: "500",
              color: "#1e293b",
            },
            width: 180,
          };
          nodesRef.current.set(id, nodeObj);
          newNodesArr.push(nodeObj);
        }
      });

      const newEdgesArr = [];
      incomingLinks.forEach((l) => {
        if (l.source == null || l.target == null) return;
        const eid = `e${l.id}`;
        if (!edgesRef.current.has(eid)) {
          const edgeObj = {
            id: eid,
            source: String(l.source),
            target: String(l.target),
            label: l.type || "",
            animated: false,
            type: "default",
            arrowHeadType: "arrow",
            style: { stroke: "#94a3b8", strokeWidth: 2 },
            labelBgStyle: { fill: "#fff", color: "#475569", fillOpacity: 0.95, fontSize: 12 },
          };
          edgesRef.current.set(eid, edgeObj);
          newEdgesArr.push(edgeObj);
        }
      });

      setNodes((nds) => {
        // merge avoiding duplicates
        const map = new Map(nds.map((n) => [n.id, n]));
        newNodesArr.forEach((nn) => map.set(nn.id, nn));
        return Array.from(map.values());
      });
      setEdges((eds) => {
        const map = new Map(eds.map((e) => [e.id, e]));
        newEdgesArr.forEach((ne) => map.set(ne.id, ne));
        return Array.from(map.values());
      });

      // after merging, recompute available counts and set limits to available max
      const grouped = {};
      nodesRef.current.forEach((meta, id) => {
        const label = meta?.data?.props?.__label || meta?.data?.label || "";
        if (!grouped[label]) grouped[label] = [];
        grouped[label].push(id);
      });

      setLabelFilters((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((lbl) => {
          const count = grouped[lbl] ? grouped[lbl].length : 0;
          // set limit to count (available max)
          updated[lbl] = { ...updated[lbl], limit: count };
        });
        return updated;
      });

      setTimeout(() => {
        if (rfInstanceRef.current && rfInstanceRef.current.fitView) {
          try {
            rfInstanceRef.current.fitView({ padding: 0.1 });
          } catch (e) {
            // ignore
          }
        }
      }, 80);
    },
    [setNodes, setEdges]
  );

  const runSearch = async (q) => {
    if (!q) return;
    setLoading(true);
    setErr(null);
    try {
      const json = await api.search(q, 25);
      setResults(json.results || []);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadSubgraph = async (nodeName) => {
    if (!nodeName) return;
    setLoading(true);
    setErr(null);
    try {
      // always request full graph
      const opts = { depth: 1, max_nodes: 2000 };
      const json = await api.getGraph(nodeName, opts);
      mergeGraph(json);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  const onNodeDoubleClick = useCallback(
    async (event, node) => {
      const nodeId = node.id;
      setLoading(true);
      setErr(null);
      try {
        const json = await api.expand(nodeId);
        mergeGraph({ nodes: json.nodes || [], links: json.links || [] });
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    },
    [mergeGraph]
  );

  const clearGraph = () => {
    nodesRef.current = new Map();
    edgesRef.current = new Map();
    setNodes([]);
    setEdges([]);
  };

  const applyClientFilters = useCallback(() => {
    const visibleNodeIds = new Set();

    const grouped = {};
    nodesRef.current.forEach((meta, id) => {
      const label = meta?.data?.props?.__label || meta?.data?.label || "";
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(id);
    });

    if (grouped["Publication"]) {
      grouped["Publication"].forEach((id) => visibleNodeIds.add(id));
    }

    Object.entries(labelFilters).forEach(([lbl, cfg]) => {
      if (cfg.enabled && grouped[lbl]) {
        const limit = Math.max(0, Number(cfg.limit) || 0);
        grouped[lbl].slice(0, limit).forEach((id) => visibleNodeIds.add(id));
      }
    });

    setNodes((prevNodes) =>
      prevNodes.map((n) => {
        const isVisible = visibleNodeIds.has(n.id);
        return {
          ...n,
          style: {
            ...n.style,
            opacity: isVisible ? 1 : 0.12,
            display: isVisible ? undefined : "none",
          },
        };
      })
    );

    setEdges((prevEdges) =>
      prevEdges.map((e) => {
        const shouldShow = visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target);
        return {
          ...e,
          style: { ...e.style, opacity: shouldShow ? 1 : 0.06 },
          hidden: !shouldShow,
        };
      })
    );
  }, [labelFilters]);

  useEffect(() => {
    applyClientFilters();
  }, [labelFilters]);

  const onInit = (rfInstance) => {
    rfInstanceRef.current = rfInstance;
  };

  useEffect(() => {
    if (rfInstanceRef.current && rfInstanceRef.current.fitView) {
      const t = setTimeout(() => rfInstanceRef.current.fitView({ padding: 0.1 }), 120);
      return () => clearTimeout(t);
    }
  }, [nodes.length, edges.length]);

  // get counts used to clamp inputs and show next to labels
  const counts = getCounts();

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Filters + search */}
      <div className="flex gap-3 mb-5 items-center flex-wrap bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex gap-3 items-center flex-wrap">
          <span className="font-semibold text-slate-700 text-sm">Filters:</span>

          {/* Publication always visible */}
          <span className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg border border-blue-200 font-medium shadow-sm">
            Publication ✓
          </span>

          {/* per-label controls: checkbox + limit */}
          {Object.keys(labelFilters).map((lbl) => (
            <div key={lbl} className="flex items-center gap-2 text-sm bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={labelFilters[lbl].enabled}
                onChange={() =>
                  setLabelFilters((prev) => ({
                    ...prev,
                    [lbl]: { ...prev[lbl], enabled: !prev[lbl].enabled },
                  }))
                }
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
              <span className="whitespace-nowrap font-medium text-slate-700">{lbl}</span>

              <span className="text-xs text-slate-500">({counts[lbl] || 0})</span>

              <input
                type="number"
                min={0}
                max={counts[lbl] || 0}
                value={labelFilters[lbl].limit}
                onChange={(e) => {
                  const avail = counts[lbl] || 0;
                  const raw = parseInt(e.target.value);
                  const val = Number.isNaN(raw) ? 0 : raw;
                  const clamped = Math.max(0, Math.min(avail, val));
                  setLabelFilters((prev) => ({
                    ...prev,
                    [lbl]: { ...prev[lbl], limit: clamped },
                  }));
                }}
                className="w-20 p-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                title="Set how many nodes of this label to show (0 = hide). Cannot exceed available count."
              />
            </div>
          ))}
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes (name or paper_title)..."
          className="flex-1 p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        <button
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg active:scale-95"
          onClick={() => runSearch(query)}
        >
          Search
        </button>
        <button
          className="px-5 py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-all shadow-sm hover:shadow active:scale-95"
          onClick={clearGraph}
        >
          Clear
        </button>
      </div>

      {/* Results + Graph */}
      <div className="flex gap-5">
        <div style={{ width: 320 }} className="overflow-auto border border-slate-200 rounded-xl p-4 bg-white shadow-md">
          <h3 className="font-bold mb-3 text-slate-800 text-lg">Results</h3>
          {loading && <div className="text-blue-600 font-medium animate-pulse">Loading...</div>}
          {err && <div className="text-red-600 mb-3 p-3 bg-red-50 rounded-lg border border-red-200 text-sm">{err}</div>}
          {results.length === 0 && <div className="text-sm text-slate-500 italic">No results</div>}
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-3">
                    <div className="font-semibold text-slate-800 text-sm">{r.name || r.label || r.id}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{r.label}</div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button
                      className="text-xs px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-md font-medium hover:from-green-600 hover:to-green-700 transition-all shadow-sm hover:shadow active:scale-95"
                      onClick={() => loadSubgraph(r.name || r.id)}
                    >
                      Open
                    </button>
                    <button
                      className="text-xs px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-white rounded-md font-medium hover:from-amber-500 hover:to-amber-600 transition-all shadow-sm hover:shadow active:scale-95"
                      onClick={() => {
                        const id = r.id;
                        if (id) onNodeDoubleClick(null, { id: String(id) });
                      }}
                    >
                      Expand
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ flex: 1, height: 640 }} className="border border-slate-200 rounded-xl bg-white shadow-lg overflow-hidden">
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDoubleClick={onNodeDoubleClick}
              onInit={onInit}
              fitView
              attributionPosition="bottom-left"
              panOnDrag={true}
              panOnScroll={false}
              zoomOnScroll={false}
              zoomOnPinch={true}
              minZoom={0.2}
              maxZoom={2.5}
              defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
              connectionLineType="bezier"
            >
              <MiniMap nodeStrokeColor={() => "#64748b"} nodeColor={() => "#f8fafc"} nodeBorderRadius={10} />
              <Controls />
              <Background gap={16} color="#e2e8f0" />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>

      <div className="mt-5 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="text-sm text-slate-600">
          <span className="font-semibold text-slate-700">💡 Tips:</span> Drag the background to pan • Pinch to zoom • Double-click node to expand • Click Clear to reset
        </div>
      </div>
    </div>
  );
}


// // src/components/GraphFlow.jsx
// import React, { useCallback, useEffect, useRef, useState } from "react";
// import ReactFlow, {
//   ReactFlowProvider,
//   useNodesState,
//   useEdgesState,
//   Controls,
//   MiniMap,
//   Background,
// } from "react-flow-renderer";
// import api from "../services/api";
// import "react-flow-renderer/dist/style.css";

// // Color palette for node categories
// const categoryColors = {
//   Disease: { bg: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", border: "#b91c1c", text: "#fff" },
//   Species: { bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)", border: "#047857", text: "#fff" },
//   Gene: { bg: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)", border: "#6d28d9", text: "#fff" },
//   Chemical: { bg: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)", border: "#0e7490", text: "#fff" },
//   Pathway: { bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", border: "#b45309", text: "#fff" },
//   SpaceEnvironmentFactor: { bg: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)", border: "#be185d", text: "#fff" },
//   Publication: { bg: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", border: "#4338ca", text: "#fff" },
//   default: { bg: "linear-gradient(135deg, #64748b 0%, #475569 100%)", border: "#334155", text: "#fff" },
// };

// function gridPosition(index, cols = 6, cell = { w: 180, h: 120 }, margin = { x: 80, y: 80 }) {
//   const col = index % cols;
//   const row = Math.floor(index / cols);
//   const x = margin.x + col * cell.w;
//   const y = margin.y + row * cell.h;
//   return { x, y };
// }

// export default function GraphFlow() {
//   const [query, setQuery] = useState("");
//   const [results, setResults] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [err, setErr] = useState(null);

//   // dynamic per-label limits: will be updated after graph loads
//   const [labelFilters, setLabelFilters] = useState({
//     Disease: { enabled: true, limit: 0 },
//     Species: { enabled: true, limit: 0 },
//     Gene: { enabled: true, limit: 0 },
//     Chemical: { enabled: true, limit: 0 },
//     Pathway: { enabled: true, limit: 0 },
//     SpaceEnvironmentFactor: { enabled: true, limit: 0 },
//   });

//   const [nodes, setNodes, onNodesChange] = useNodesState([]);
//   const [edges, setEdges, onEdgesChange] = useEdgesState([]);
//   const nodesRef = useRef(new Map());
//   const edgesRef = useRef(new Map());
//   const rfInstanceRef = useRef(null);

//   // compute current counts per label from nodesRef
//   const getCounts = useCallback(() => {
//     const grouped = {};
//     nodesRef.current.forEach((meta) => {
//       const label = meta?.data?.props?.__label || meta?.data?.label || "";
//       grouped[label] = (grouped[label] || 0) + 1;
//     });
//     return grouped;
//   }, []);

//   const mergeGraph = useCallback(
//     (json) => {
//       const incoming = json || { nodes: [], links: [] };
//       const incomingNodes = Array.isArray(incoming.nodes) ? incoming.nodes : [];
//       const incomingLinks = Array.isArray(incoming.links) ? incoming.links : [];

//       const newNodesArr = [];
//       incomingNodes.forEach((n) => {
//         const id = String(n.id);
//         const name = n.name || n.paper_title || n.label || id;
//         if (!nodesRef.current.has(id)) {
//           const totalExisting = nodesRef.current.size + newNodesArr.length;
//           const cols = Math.max(4, Math.round(Math.sqrt(Math.max(1, totalExisting + incomingNodes.length))));
//           const pos = gridPosition(totalExisting, cols);

//           const data = { label: name, props: n.props || {} };
//           data.props.__label = n.label || "";

//           // Apply color scheme based on label
//           const nodeLabel = n.label || "";
//           const colors = categoryColors[nodeLabel] || categoryColors.default;

//           const nodeObj = {
//             id,
//             position: pos,
//             data,
//             draggable: true,
//             selectable: true,
//             style: {
//               border: `2px solid ${colors.border}`,
//               padding: 14,
//               borderRadius: 12,
//               background: colors.bg,
//               boxShadow: "0 8px 16px -4px rgba(0,0,0,0.3), 0 4px 8px -2px rgba(0,0,0,0.2)",
//               minWidth: 140,
//               fontSize: "13px",
//               fontWeight: "600",
//               color: colors.text,
//             },
//             width: 180,
//           };
//           nodesRef.current.set(id, nodeObj);
//           newNodesArr.push(nodeObj);
//         }
//       });

//       const newEdgesArr = [];
//       incomingLinks.forEach((l) => {
//         if (l.source == null || l.target == null) return;
//         const eid = `e${l.id}`;
//         if (!edgesRef.current.has(eid)) {
//           const edgeObj = {
//             id: eid,
//             source: String(l.source),
//             target: String(l.target),
//             label: l.type || "",
//             animated: true,
//             type: "default",
//             arrowHeadType: "arrow",
//             style: { stroke: "#60a5fa", strokeWidth: 2.5 },
//             labelBgStyle: { fill: "#1e293b", color: "#e2e8f0", fillOpacity: 0.9, fontSize: 11 },
//           };
//           edgesRef.current.set(eid, edgeObj);
//           newEdgesArr.push(edgeObj);
//         }
//       });

//       setNodes((nds) => {
//         // merge avoiding duplicates
//         const map = new Map(nds.map((n) => [n.id, n]));
//         newNodesArr.forEach((nn) => map.set(nn.id, nn));
//         return Array.from(map.values());
//       });
//       setEdges((eds) => {
//         const map = new Map(eds.map((e) => [e.id, e]));
//         newEdgesArr.forEach((ne) => map.set(ne.id, ne));
//         return Array.from(map.values());
//       });

//       // after merging, recompute available counts and set limits to available max
//       const grouped = {};
//       nodesRef.current.forEach((meta, id) => {
//         const label = meta?.data?.props?.__label || meta?.data?.label || "";
//         if (!grouped[label]) grouped[label] = [];
//         grouped[label].push(id);
//       });

//       setLabelFilters((prev) => {
//         const updated = { ...prev };
//         Object.keys(updated).forEach((lbl) => {
//           const count = grouped[lbl] ? grouped[lbl].length : 0;
//           // set limit to count (available max)
//           updated[lbl] = { ...updated[lbl], limit: count };
//         });
//         return updated;
//       });

//       setTimeout(() => {
//         if (rfInstanceRef.current && rfInstanceRef.current.fitView) {
//           try {
//             rfInstanceRef.current.fitView({ padding: 0.1 });
//           } catch (e) {
//             // ignore
//           }
//         }
//       }, 80);
//     },
//     [setNodes, setEdges]
//   );

//   const runSearch = async (q) => {
//     if (!q) return;
//     setLoading(true);
//     setErr(null);
//     try {
//       const json = await api.search(q, 25);
//       setResults(json.results || []);
//     } catch (e) {
//       setErr(String(e));
//     } finally {
//       setLoading(false);
//     }
//   };

//   const loadSubgraph = async (nodeName) => {
//     if (!nodeName) return;
//     setLoading(true);
//     setErr(null);
//     try {
//       // always request full graph
//       const opts = { depth: 1, max_nodes: 2000 };
//       const json = await api.getGraph(nodeName, opts);
//       mergeGraph(json);
//     } catch (e) {
//       setErr(String(e));
//     } finally {
//       setLoading(false);
//     }
//   };

//   const onNodeDoubleClick = useCallback(
//     async (event, node) => {
//       const nodeId = node.id;
//       setLoading(true);
//       setErr(null);
//       try {
//         const json = await api.expand(nodeId);
//         mergeGraph({ nodes: json.nodes || [], links: json.links || [] });
//       } catch (e) {
//         setErr(String(e));
//       } finally {
//         setLoading(false);
//       }
//     },
//     [mergeGraph]
//   );

//   const clearGraph = () => {
//     nodesRef.current = new Map();
//     edgesRef.current = new Map();
//     setNodes([]);
//     setEdges([]);
//   };

//   const applyClientFilters = useCallback(() => {
//     const visibleNodeIds = new Set();

//     const grouped = {};
//     nodesRef.current.forEach((meta, id) => {
//       const label = meta?.data?.props?.__label || meta?.data?.label || "";
//       if (!grouped[label]) grouped[label] = [];
//       grouped[label].push(id);
//     });

//     if (grouped["Publication"]) {
//       grouped["Publication"].forEach((id) => visibleNodeIds.add(id));
//     }

//     Object.entries(labelFilters).forEach(([lbl, cfg]) => {
//       if (cfg.enabled && grouped[lbl]) {
//         const limit = Math.max(0, Number(cfg.limit) || 0);
//         grouped[lbl].slice(0, limit).forEach((id) => visibleNodeIds.add(id));
//       }
//     });

//     setNodes((prevNodes) =>
//       prevNodes.map((n) => {
//         const isVisible = visibleNodeIds.has(n.id);
//         return {
//           ...n,
//           style: {
//             ...n.style,
//             opacity: isVisible ? 1 : 0.12,
//             display: isVisible ? undefined : "none",
//           },
//         };
//       })
//     );

//     setEdges((prevEdges) =>
//       prevEdges.map((e) => {
//         const shouldShow = visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target);
//         return {
//           ...e,
//           style: { ...e.style, opacity: shouldShow ? 1 : 0.06 },
//           hidden: !shouldShow,
//         };
//       })
//     );
//   }, [labelFilters]);

//   useEffect(() => {
//     applyClientFilters();
//   }, [labelFilters]);

//   const onInit = (rfInstance) => {
//     rfInstanceRef.current = rfInstance;
//   };

//   useEffect(() => {
//     if (rfInstanceRef.current && rfInstanceRef.current.fitView) {
//       const t = setTimeout(() => rfInstanceRef.current.fitView({ padding: 0.1 }), 120);
//       return () => clearTimeout(t);
//     }
//   }, [nodes.length, edges.length]);

//   // get counts used to clamp inputs and show next to labels
//   const counts = getCounts();

//   const getLabelColor = (label) => {
//     const colors = categoryColors[label] || categoryColors.default;
//     return colors.border;
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 p-6">
//       <style>{`
//         .glass-panel {
//           background: rgba(15, 23, 42, 0.7);
//           backdrop-filter: blur(12px);
//           -webkit-backdrop-filter: blur(12px);
//           border: 1px solid rgba(148, 163, 184, 0.2);
//         }
//         .glass-input {
//           background: rgba(30, 41, 59, 0.6);
//           backdrop-filter: blur(8px);
//           -webkit-backdrop-filter: blur(8px);
//           border: 1px solid rgba(148, 163, 184, 0.3);
//           color: #e2e8f0;
//         }
//         .glass-input::placeholder {
//           color: #94a3b8;
//         }
//         .glass-input:focus {
//           background: rgba(30, 41, 59, 0.8);
//           border-color: #60a5fa;
//         }
//       `}</style>

//       {/* Filters + search */}
//       <div className="glass-panel rounded-2xl p-5 mb-5 shadow-2xl">
//         <div className="flex gap-3 items-center flex-wrap mb-4">
//           <span className="font-semibold text-cyan-400 text-sm uppercase tracking-wide">Filters:</span>

//           {/* Publication always visible */}
//           <span className="px-3 py-1.5 text-sm text-white rounded-lg font-medium shadow-lg" style={{ background: categoryColors.Publication.bg }}>
//             Publication ✓
//           </span>

//           {/* per-label controls: checkbox + limit */}
//           {Object.keys(labelFilters).map((lbl) => (
//             <div key={lbl} className="flex items-center gap-2 text-sm glass-input px-3 py-2 rounded-lg shadow-md">
//               <input
//                 type="checkbox"
//                 checked={labelFilters[lbl].enabled}
//                 onChange={() =>
//                   setLabelFilters((prev) => ({
//                     ...prev,
//                     [lbl]: { ...prev[lbl], enabled: !prev[lbl].enabled },
//                   }))
//                 }
//                 className="w-4 h-4 rounded focus:ring-2 cursor-pointer"
//                 style={{ accentColor: getLabelColor(lbl) }}
//               />
//               <span className="whitespace-nowrap font-medium text-slate-200">{lbl}</span>

//               <span className="text-xs font-mono" style={{ color: getLabelColor(lbl) }}>({counts[lbl] || 0})</span>

//               <input
//                 type="number"
//                 min={0}
//                 max={counts[lbl] || 0}
//                 value={labelFilters[lbl].limit}
//                 onChange={(e) => {
//                   const avail = counts[lbl] || 0;
//                   const raw = parseInt(e.target.value);
//                   const val = Number.isNaN(raw) ? 0 : raw;
//                   const clamped = Math.max(0, Math.min(avail, val));
//                   setLabelFilters((prev) => ({
//                     ...prev,
//                     [lbl]: { ...prev[lbl], limit: clamped },
//                   }));
//                 }}
//                 className="w-20 p-1.5 glass-input rounded-md text-xs focus:outline-none focus:ring-2 font-mono"
//                 style={{ borderColor: getLabelColor(lbl) }}
//                 title="Set how many nodes of this label to show (0 = hide). Cannot exceed available count."
//               />
//             </div>
//           ))}
//         </div>

//         <div className="flex gap-3 items-center">
//           <input
//             value={query}
//             onChange={(e) => setQuery(e.target.value)}
//             placeholder="Search nodes (name or paper_title)..."
//             className="flex-1 p-3 glass-input rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
//           />
//           <button
//             className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-cyan-500/50 active:scale-95"
//             onClick={() => runSearch(query)}
//           >
//             Search
//           </button>
//           <button
//             className="px-6 py-3 glass-input text-slate-200 rounded-xl font-semibold hover:bg-slate-700/50 transition-all shadow-lg active:scale-95"
//             onClick={clearGraph}
//           >
//             Clear
//           </button>
//         </div>
//       </div>

//       {/* Results + Graph */}
//       <div className="flex gap-5">
//         <div style={{ width: 320 }} className="glass-panel rounded-2xl p-5 shadow-2xl overflow-auto" style={{ maxHeight: 640 }}>
//           <h3 className="font-bold mb-4 text-cyan-400 text-lg uppercase tracking-wide">Results</h3>
//           {loading && (
//             <div className="flex items-center gap-2 text-cyan-400 font-medium">
//               <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
//               Loading...
//             </div>
//           )}
//           {err && <div className="text-red-400 mb-3 p-3 bg-red-500/10 rounded-lg border border-red-500/30 text-sm">{err}</div>}
//           {results.length === 0 && !loading && <div className="text-sm text-slate-500 italic">No results</div>}
//           <ul className="space-y-3">
//             {results.map((r) => {
//               const colors = categoryColors[r.label] || categoryColors.default;
//               return (
//                 <li key={r.id} className="glass-input rounded-xl p-3 hover:bg-slate-700/40 transition-colors shadow-md">
//                   <div className="flex items-center justify-between">
//                     <div className="flex-1 mr-3">
//                       <div className="font-semibold text-slate-200 text-sm">{r.name || r.label || r.id}</div>
//                       <div className="text-xs mt-1 px-2 py-0.5 rounded inline-block font-medium" style={{ background: colors.bg, color: colors.text }}>
//                         {r.label}
//                       </div>
//                     </div>
//                     <div className="flex flex-col gap-1.5">
//                       <button
//                         className="text-xs px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md font-medium hover:from-green-600 hover:to-emerald-700 transition-all shadow-sm hover:shadow-green-500/50 active:scale-95"
//                         onClick={() => loadSubgraph(r.name || r.id)}
//                       >
//                         Open
//                       </button>
//                       <button
//                         className="text-xs px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-white rounded-md font-medium hover:from-amber-500 hover:to-amber-600 transition-all shadow-sm hover:shadow-amber-500/50 active:scale-95"
//                         onClick={() => {
//                           const id = r.id;
//                           if (id) onNodeDoubleClick(null, { id: String(id) });
//                         }}
//                       >
//                         Expand
//                       </button>
//                     </div>
//                   </div>
//                 </li>
//               );
//             })}
//           </ul>
//         </div>

//         <div style={{ flex: 1, height: 640 }} className="glass-panel rounded-2xl shadow-2xl overflow-hidden">
//           <ReactFlowProvider>
//             <ReactFlow
//               nodes={nodes}
//               edges={edges}
//               onNodesChange={onNodesChange}
//               onEdgesChange={onEdgesChange}
//               onNodeDoubleClick={onNodeDoubleClick}
//               onInit={onInit}
//               fitView
//               attributionPosition="bottom-left"
//               panOnDrag={true}
//               panOnScroll={false}
//               zoomOnScroll={false}
//               zoomOnPinch={true}
//               minZoom={0.2}
//               maxZoom={2.5}
//               defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
//               connectionLineType="bezier"
//             >
//               <MiniMap 
//                 nodeStrokeColor={() => "#60a5fa"} 
//                 nodeColor={(node) => {
//                   const label = node?.data?.props?.__label || "";
//                   const colors = categoryColors[label] || categoryColors.default;
//                   return colors.border;
//                 }}
//                 nodeBorderRadius={10}
//                 style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(148, 163, 184, 0.3)" }}
//               />
//               <Controls style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(148, 163, 184, 0.3)" }} />
//               <Background gap={16} color="#334155" style={{ background: "#0f172a" }} />
//             </ReactFlow>
//           </ReactFlowProvider>
//         </div>
//       </div>

//       <div className="mt-5 glass-panel rounded-2xl p-4 shadow-xl">
//         <div className="text-sm text-slate-300">
//           <span className="font-semibold text-cyan-400">💡 Tips:</span> Drag the background to pan • Pinch to zoom • Double-click node to expand • Click Clear to reset
//         </div>
//       </div>
//     </div>
//   );
// }