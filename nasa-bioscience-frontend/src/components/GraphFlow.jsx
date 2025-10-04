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

// import progress context hook
import { useProgress } from "../context/ProgressContext";

function gridPosition(index, cols = 6, cell = { w: 180, h: 120 }, margin = { x: 80, y: 80 }) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = margin.x + col * cell.w;
  const y = margin.y + row * cell.h;
  return { x, y };
}

export default function GraphFlow() {
  const { progress, updateProgress } = useProgress();

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

  // helper to update nodesRef/edgesRef when nodes/edges state changes
  useEffect(() => {
    const map = new Map();
    nodes.forEach((n) => {
      map.set(String(n.id), n);
    });
    nodesRef.current = map;
  }, [nodes]);

  useEffect(() => {
    const map = new Map();
    edges.forEach((e) => {
      map.set(String(e.id), e);
    });
    edgesRef.current = map;
  }, [edges]);

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

          // Define color scheme for each category
          const categoryColors = {
            Disease: { bg: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)", border: "#ef4444", text: "#991b1b" },
            Species: { bg: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)", border: "#3b82f6", text: "#1e3a8a" },
            Gene: { bg: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)", border: "#22c55e", text: "#14532d" },
            Chemical: { bg: "linear-gradient(135deg, #fef3c7 0%, #fde047 100%)", border: "#eab308", text: "#713f12" },
            Pathway: { bg: "linear-gradient(135deg, #e9d5ff 0%, #d8b4fe 100%)", border: "#a855f7", text: "#581c87" },
            SpaceEnvironmentFactor: { bg: "linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)", border: "#f97316", text: "#7c2d12" },
            Publication: { bg: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)", border: "#0ea5e9", text: "#0c4a6e" },
          };

          const nodeLabel = n.label || "";
          const colors = categoryColors[nodeLabel] || { bg: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "#e2e8f0", text: "#1e293b" };

          const nodeObj = {
            id,
            position: pos,
            data,
            draggable: true,
            selectable: true,
            style: {
              border: `2px solid ${colors.border}`,
              padding: 14,
              borderRadius: 10,
              background: colors.bg,
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
              minWidth: 140,
              fontSize: "14px",
              fontWeight: "500",
              color: colors.text,
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

  // Updated clearGraph: clears UI + saved progress
  const clearGraph = () => {
    // Clear in-memory state
    nodesRef.current = new Map();
    edgesRef.current = new Map();
    setNodes([]);
    setEdges([]);
    setResults([]);
    setQuery("");
    setLabelFilters({
      Disease: { enabled: true, limit: 0 },
      Species: { enabled: true, limit: 0 },
      Gene: { enabled: true, limit: 0 },
      Chemical: { enabled: true, limit: 0 },
      Pathway: { enabled: true, limit: 0 },
      SpaceEnvironmentFactor: { enabled: true, limit: 0 },
    });

    // Clear saved progress for this page in your app-wide progress object
    try {
      updateProgress({ graphFlow: {} });
    } catch (e) {
      // ignore
    }

    // Additionally remove graphFlow key from raw localStorage 'app:progress' object (defensive)
    try {
      const raw = window.localStorage.getItem("app:progress");
      if (raw) {
        const all = JSON.parse(raw);
        if (all && typeof all === "object" && all.graphFlow) {
          delete all.graphFlow;
          window.localStorage.setItem("app:progress", JSON.stringify(all));
        }
      }
    } catch (e) {
      console.error("Failed to clear stored GraphFlow progress", e);
    }
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

  useEffect(() => {
    if (rfInstanceRef.current && rfInstanceRef.current.fitView) {
      const t = setTimeout(() => rfInstanceRef.current.fitView({ padding: 0.1 }), 120);
      return () => clearTimeout(t);
    }
  }, [nodes.length, edges.length]);

  // get counts used to clamp inputs and show next to labels
  const counts = getCounts();

  // ---------------------------
  // Progress save / restore
  // ---------------------------
  // Restore state from global progress (only once on mount)
  useEffect(() => {
    try {
      const saved = progress?.graphFlow;
      if (saved) {
        if (Array.isArray(saved.nodes) && saved.nodes.length > 0) {
          setNodes(saved.nodes);
        }
        if (Array.isArray(saved.edges) && saved.edges.length > 0) {
          setEdges(saved.edges);
        }
        if (saved.labelFilters) {
          setLabelFilters((prev) => ({ ...prev, ...saved.labelFilters }));
        }
        if (typeof saved.query === "string") {
          setQuery(saved.query);
        }
        if (Array.isArray(saved.results)) {
          setResults(saved.results);
        }
      }
    } catch (e) {
      // ignore restore errors
      // console.error("Failed to restore graphFlow progress", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run only once

  // Debounced save: whenever key pieces change, persist to global progress via updateProgress
  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        // keep saved payload reasonably small: nodes, edges, labelFilters, query, results
        updateProgress({
          graphFlow: {
            nodes: nodes || [],
            edges: edges || [],
            labelFilters: labelFilters || {},
            query: query || "",
            results: results || [],
            // skip viewport for now
          },
        });
      } catch (e) {
        console.error("Failed to save graphFlow progress", e);
      }
    }, 700); // debounce window

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, labelFilters, query, results]);

  // ---------------------------
  // end progress save/restore
  // ---------------------------

  const onInit = (rfInstance) => {
    rfInstanceRef.current = rfInstance;
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Filters + search */}
      <div className="flex gap-2 sm:gap-3 mb-3 sm:mb-5 items-center flex-wrap bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex gap-2 sm:gap-3 items-center flex-wrap w-full sm:w-auto">
          <span className="font-semibold text-slate-700 text-xs sm:text-sm">Filters:</span>

          {/* Publication always visible */}
          <span className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm bg-blue-50 text-blue-700 rounded-lg border border-blue-200 font-medium shadow-sm">
            Publication ✓
          </span>

          {/* per-label controls: checkbox + limit */}
          {Object.keys(labelFilters).map((lbl) => (
            <div key={lbl} className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm bg-slate-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={labelFilters[lbl].enabled}
                onChange={() =>
                  setLabelFilters((prev) => ({
                    ...prev,
                    [lbl]: { ...prev[lbl], enabled: !prev[lbl].enabled },
                  }))
                }
                className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
              <span className="whitespace-nowrap font-medium text-slate-700 text-xs sm:text-sm">{lbl}</span>

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
                className="w-14 sm:w-20 p-1 sm:p-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                title="Set how many nodes of this label to show (0 = hide). Cannot exceed available count."
              />
            </div>
          ))}
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes..."
          className="w-full sm:flex-1 sm:min-w-[300px] lg:min-w-[400px] p-2 sm:p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm"
        />
        <button
          className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg active:scale-95 text-sm"
          onClick={() => runSearch(query)}
        >
          Search
        </button>
        <button
          className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-all shadow-sm hover:shadow active:scale-95 text-sm"
          onClick={clearGraph}
        >
          Clear
        </button>
      </div>

      {/* Results + Graph */}
      <div className="flex flex-col lg:flex-row gap-3 sm:gap-5">
        <div className="w-full lg:w-80 overflow-auto border border-slate-200 rounded-xl p-3 sm:p-4 bg-white shadow-md max-h-96 lg:max-h-none">
          <h3 className="font-bold mb-2 sm:mb-3 text-slate-800 text-base sm:text-lg">Results</h3>
          {loading && <div className="text-blue-600 font-medium animate-pulse">Loading...</div>}
          {err && <div className="text-red-600 mb-2 sm:mb-3 p-2 sm:p-3 bg-red-50 rounded-lg border border-red-200 text-xs sm:text-sm">{err}</div>}
          {results.length === 0 && <div className="text-sm text-slate-500 italic">No results</div>}
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.id} className="p-2 sm:p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex-1 w-full sm:mr-3">
                    <div className="font-semibold text-slate-800 text-xs sm:text-sm">{r.name || r.label || r.id}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{r.label}</div>
                  </div>
                  <div className="flex flex-row sm:flex-col gap-1.5 w-full sm:w-auto">
                    <button
                      className="text-xs px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-md font-medium hover:from-green-600 hover:to-green-700 transition-all shadow-sm hover:shadow active:scale-95 flex-1 sm:flex-none"
                      onClick={() => loadSubgraph(r.name || r.id)}
                    >
                      Open
                    </button>
                    <button
                      className="text-xs px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-white rounded-md font-medium hover:from-amber-500 hover:to-amber-600 transition-all shadow-sm hover:shadow active:scale-95 flex-1 sm:flex-none"
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

        <div className="flex-1 h-64 sm:h-96 md:h-[500px] lg:h-[640px] border border-slate-200 rounded-xl bg-white shadow-lg overflow-hidden">
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

      <div className="mt-3 sm:mt-5 p-3 sm:p-4 bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="text-xs sm:text-sm text-slate-600">
          <span className="font-semibold text-slate-700"> Tips:</span> Drag the background to pan • Pinch to zoom • Double-click node to expand • Click Clear to reset
        </div>
      </div>
    </div>
  );
}