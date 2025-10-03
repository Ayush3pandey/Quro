# graph_api.py
from fastapi import APIRouter, HTTPException, Query
from neo4j import GraphDatabase
from dotenv import load_dotenv
import os, time, logging


load_dotenv()
router = APIRouter(prefix="/api")

logger = logging.getLogger("graph-api")

# Load Aura credentials from .env
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")


# Connect to Neo4j Aura
driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD ))
try:
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    driver.verify_connectivity()
    logger.info("Connected to Neo4j Aura")
except Exception as e:
    logger.error("Neo4j connection failed: %s", e)

def props_to_primitives(props: dict) -> dict:
    out = {}
    for k, v in (props or {}).items():
        try:
            if hasattr(v, "isoformat"):
                out[k] = v.isoformat()
            else:
                out[k] = v
        except Exception:
            out[k] = str(v)
    return out

@router.get("/health")
def health():
    return {"status": "ok"}

@router.get("/search")
def search(q: str, limit: int = Query(25, ge=1, le=200)):
    if not driver:
        raise HTTPException(status_code=503, detail="DB unavailable")
    cy = """
    MATCH (n)
    WHERE toLower(coalesce(n.name, n.paper_title, '')) CONTAINS toLower($q)
    RETURN DISTINCT id(n) AS id, labels(n) AS labels, properties(n) AS props
    LIMIT $limit
    """
    with driver.session() as session:
        recs = list(session.run(cy, q=q, limit=limit))
    results = []
    for r in recs:
        props = props_to_primitives(r["props"] or {})
        name = props.get("name") or props.get("paper_title") or ""
        label = (r["labels"][0] if r["labels"] else "Node")
        results.append({"id": str(r["id"]), "name": name, "label": label, "props": props})
    return {"results": results}

@router.get("/graph/{node_name}")
def get_subgraph(
    node_name: str,
    depth: int = Query(1, ge=0, le=2),
    max_nodes: int = Query(300, ge=10, le=2000),
    min_degree: int = Query(0, ge=0),
    labels: str = None
):
    if not driver:
        raise HTTPException(status_code=503, detail="DB unavailable")

    # Split labels if provided
    label_list = [l.strip() for l in labels.split(",")] if labels else []

    with driver.session() as session:
        # Step 1: find the starting node(s)
        find_start = """
        MATCH (start)
        WHERE toLower(coalesce(start.name, start.paper_title, '')) = toLower($node_name)
        RETURN DISTINCT id(start) AS id
        """
        starts = [r["id"] for r in session.run(find_start, node_name=node_name)]
        if not starts:
            raise HTTPException(status_code=404, detail=f"No node found with name/paper_title '{node_name}'")

        # Step 2: find nodes
        nodes_cypher = f"""
        MATCH (start) WHERE id(start) IN $start_ids
        MATCH path=(start)-[*0..{depth}]-(n)
        WITH DISTINCT n
        CALL {{
          WITH n
          MATCH (n)--()
          RETURN count(*) AS deg
        }}
        WITH n, deg
        WHERE deg >= $min_degree
        {"AND any(l IN labels(n) WHERE l IN $label_list)" if label_list else ""}
        RETURN DISTINCT id(n) AS id, labels(n) AS labels, properties(n) AS props
        LIMIT $max_nodes
        """
        node_recs = list(session.run(nodes_cypher, start_ids=starts, min_degree=min_degree,
                                     max_nodes=max_nodes, label_list=label_list))

        # Step 3: find relationships between those nodes
        rels_cypher = f"""
        MATCH (start) WHERE id(start) IN $start_ids
        MATCH (start)-[*0..{depth}]-(n)
        WITH collect(DISTINCT id(n)) AS node_ids
        UNWIND node_ids AS nid
        MATCH (a)-[r]-(b)
        WHERE id(a) = nid AND id(b) IN node_ids
        RETURN DISTINCT id(r) AS id, type(r) AS type,
                        id(a) AS source, id(b) AS target,
                        properties(r) AS props
        """
        rel_recs = list(session.run(rels_cypher, start_ids=starts))

    # Format nodes
    node_map = {}
    for r in node_recs:
        nid = r["id"]
        props = props_to_primitives(r["props"] or {})
        name = props.get("name") or props.get("paper_title") or ""
        label = r["labels"][0] if r["labels"] else "Node"
        node_map[nid] = {"id": str(nid), "name": name, "label": label, "props": props}

    # Format relationships
    links, seen = [], set()
    for r in rel_recs:
        rid = r["id"]
        if rid in seen:
            continue
        seen.add(rid)
        src, tgt = r["source"], r["target"]
        if src in node_map and tgt in node_map:
            links.append({
                "id": str(rid),
                "source": str(src),
                "target": str(tgt),
                "type": r["type"],
                "props": props_to_primitives(r["props"] or {})
            })

    return {"nodes": list(node_map.values()), "links": links}


@router.get("/expand/{node_id}")
def expand_node(node_id: int):
    if not driver:
        raise HTTPException(status_code=503, detail="DB unavailable")
    cy = """
    MATCH (n) WHERE id(n) = $node_id
    MATCH (n)-[r]-(m)
    RETURN DISTINCT id(n) AS center, id(m) AS id, labels(m) AS labels, properties(m) AS props,
           id(r) AS rel_id, type(r) AS rel_type, properties(r) AS rel_props
    """
    with driver.session() as session:
        recs = list(session.run(cy, node_id=node_id))
    if not recs:
        raise HTTPException(status_code=404, detail=f"No node with id {node_id}")
    nodes = {}
    links = []
    center_id = None
    for r in recs:
        center_id = r["center"]
        nid = r["id"]
        if nid not in nodes:
            props = props_to_primitives(r["props"] or {})
            name = props.get("name") or props.get("paper_title") or ""
            label = (r["labels"][0] if r["labels"] else "Node")
            nodes[nid] = {"id": str(nid), "name": name, "label": label, "props": props}
        links.append({
            "id": str(r["rel_id"]),
            "source": str(center_id),
            "target": str(nid),
            "type": r["rel_type"],
            "props": props_to_primitives(r["rel_props"] or {})
        })
    return {"center": {"id": str(center_id)}, "nodes": list(nodes.values()), "links": links}
