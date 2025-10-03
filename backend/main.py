

import json
import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import List, Optional
import re


app = FastAPI(title="NASA PMC Publications API", version="1.2.0")
from graph_api import router as graph_router
app.include_router(graph_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

publications_db = {}

@app.on_event("startup")
def load_data():
    global publications_db
    try:
        with open("publications.json", "r", encoding="utf-8") as f:
            publications_db = json.load(f)
        
        # Filter out error entries for cleaner API responses
        valid_publications = {}
        for pmcid, data in publications_db.items():
            if (data.get('fetch_success', True) and 
                '[ERROR]' not in data.get('title', '') and
                'error' not in data.get('categories', [])):
                valid_publications[pmcid] = data
        
        publications_db = valid_publications
        print(f"Loaded {len(publications_db)} valid PMC publications")
        
        # Show PDF download stats
        pdf_downloaded = sum(1 for p in publications_db.values() if p.get('pdf_downloaded', False))
        print(f" PDFs available: {pdf_downloaded}")
        
    except Exception as e:
        print(f" Error loading publications: {e}")
        publications_db = {}

@app.get("/")
def root():
    pdf_count = sum(1 for p in publications_db.values() if p.get('pdf_downloaded', False))
    return {
        "message": " NASA PMC Publications API",
        "total_publications": len(publications_db),
        "pdfs_available": pdf_count,
        "version": "1.2.0",
        "endpoints": [
            "GET /docs - API Documentation",
            "GET /papers - Get all papers with pagination",
            "GET /paper/{pmcid} - Get specific paper by PMC ID",
            "GET /search?query=term - Search papers",
            "GET /filter?category=name - Filter by category (supports query & multiple categories & sorting)",
            "GET /categories - Get all categories",
            "GET /journals - Get all journals",
            "GET /authors - Get top authors",
            "GET /stats - Database statistics",
            "GET /pdf/{pmcid} - Download PDF (if available)"
        ]
    }

@app.get("/papers")
def get_papers(page: int = 1, per_page: int = 20, sort_by: str = "year", sort_order: str = "desc"):
    papers = list(publications_db.values())
    reverse = sort_order == "desc"
    
    if sort_by in {"year", "title", "journal"}:
        # attempt numeric year ordering when asked
        if sort_by == "year":
            def normalize_year(y):
                if not y:
                    return 0
                if isinstance(y, int):
                    return y
                s = str(y)
                m = re.search(r"\d{4}", s)
                return int(m.group(0)) if m else 0
            papers.sort(key=lambda x: normalize_year(x.get("year")), reverse=reverse)
        else:
            papers.sort(key=lambda x: (x.get(sort_by) or "").lower(), reverse=reverse)
    
    total = len(papers)
    start = (page - 1) * per_page
    end = start + per_page
    
    return {
        "publications": papers[start:end],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page
    }

@app.get("/paper/{pmcid}")
def get_paper(pmcid: str):
    if pmcid not in publications_db:
        raise HTTPException(404, f"PMC ID {pmcid} not found")
    return publications_db[pmcid]

@app.get("/search")
def search_papers(query: str, page: int = 1, per_page: int = 20, search_fields: str = "title,abstract"):
    query_lower = query.lower()
    search_field_list = [field.strip() for field in search_fields.split(',')]
    results = []
    
    for pmcid, data in publications_db.items():
        match_found = False
        
        # Search in specified fields
        if 'title' in search_field_list and query_lower in (data.get("title") or "").lower():
            match_found = True
        if 'abstract' in search_field_list and query_lower in (data.get("abstract") or "").lower():
            match_found = True
        if 'authors' in search_field_list:
            authors_text = " ".join(data.get("authors", [])).lower()
            if query_lower in authors_text:
                match_found = True
        if 'keywords' in search_field_list:
            keywords_text = " ".join(data.get("keywords", [])).lower()
            if query_lower in keywords_text:
                match_found = True
        if 'categories' in search_field_list:
            categories_text = " ".join(data.get("categories", [])).lower()
            if query_lower in categories_text:
                match_found = True
        
        if match_found:
            results.append(data)
    
    # Sort by year (newest first)
    def normalize_year(y):
        if not y:
            return 0
        if isinstance(y, int):
            return y
        s = str(y)
        m = re.search(r"\d{4}", s)
        return int(m.group(0)) if m else 0

    results.sort(key=lambda x: normalize_year(x.get("year")), reverse=True)
    
    total = len(results)
    start = (page - 1) * per_page
    end = start + per_page
    
    return {
        "publications": results[start:end],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
        "query": query,
        "search_fields": search_fields
    }

@app.get("/filter")
def filter_papers(
    category: Optional[List[str]] = Query(None), 
    year: Optional[int] = Query(None), 
    journal: Optional[str] = Query(None),
    author: Optional[str] = Query(None),
    has_pdf: Optional[bool] = Query(None),
    query: Optional[str] = Query(None),
    search_fields: str = Query("title,abstract"),
    sort_by: Optional[str] = Query(None),            # new: "year" etc.
    sort_order: str = Query("desc"),                 # new: "asc" or "desc"
    page: int = 1, 
    per_page: int = 20
):
    """
    Filter papers with optional combined `query`.
    - category: can be provided multiple times (e.g. ?category=A&category=B) or omitted
    - query: optional text search (applies to search_fields)
    - search_fields: comma separated fields to search when `query` is present
    - sort_by: optional field to sort (supports 'year' currently)
    - sort_order: 'asc' or 'desc'
    """
    results = []
    filter_info = []

    # Normalize category list (lowercase for case-insensitive matching)
    category_list = [c.lower() for c in category] if category else None
    search_field_list = [f.strip() for f in search_fields.split(',')]

    q_lower = query.lower() if query else None

    for pmcid, data in publications_db.items():
        match = True

        # Category filter (allow multiple)
        if category_list:
            data_cats = [c.lower() for c in data.get("categories", [])]
            # require that publication has at least one of the requested categories
            if not any(any(cat_item in dc for dc in data_cats) or cat_item in " ".join(data_cats) for cat_item in category_list):
                match = False

        # Year
        if year and match:
            if data.get("year") != year:
                match = False

        # Journal
        if journal and match:
            if journal.lower() not in (data.get("journal") or "").lower():
                match = False

        # Author
        if author and match:
            authors_text = " ".join(data.get("authors", [])).lower()
            if author.lower() not in authors_text:
                match = False

        # PDF availability
        if has_pdf is not None and match:
            if bool(data.get("pdf_downloaded", False)) != bool(has_pdf):
                match = False

        # If still matching and a text query is provided, test query against requested fields
        if match and q_lower:
            text_matched = False
            # title
            if 'title' in search_field_list and q_lower in (data.get("title") or "").lower():
                text_matched = True
            # abstract
            if not text_matched and 'abstract' in search_field_list and q_lower in (data.get("abstract") or "").lower():
                text_matched = True
            # authors
            if not text_matched and 'authors' in search_field_list:
                authors_text = " ".join(data.get("authors", [])).lower()
                if q_lower in authors_text:
                    text_matched = True
            # keywords
            if not text_matched and 'keywords' in search_field_list:
                keywords_text = " ".join(data.get("keywords", [])).lower()
                if q_lower in keywords_text:
                    text_matched = True
            # categories
            if not text_matched and 'categories' in search_field_list:
                categories_text = " ".join(data.get("categories", [])).lower()
                if q_lower in categories_text:
                    text_matched = True

            if not text_matched:
                match = False

        if match:
            results.append(data)

    # Build filter info for debugging/UI
    if category_list:
        filter_info.append(f"category: {', '.join(category_list)}")
    if year:
        filter_info.append(f"year: {year}")
    if journal:
        filter_info.append(f"journal: {journal}")
    if author:
        filter_info.append(f"author: {author}")
    if has_pdf is not None:
        filter_info.append(f"has_pdf: {has_pdf}")
    if query:
        filter_info.append(f"query: {query}")
    if search_fields:
        filter_info.append(f"search_fields: {search_fields}")
    if sort_by:
        filter_info.append(f"sort_by: {sort_by}")
    if sort_order:
        filter_info.append(f"sort_order: {sort_order}")

    # --- SERVER-SIDE SORT BEFORE PAGINATION ---
    def normalize_year(y):
        if not y:
            return None
        if isinstance(y, int):
            return y
        s = str(y)
        m = re.search(r"\d{4}", s)
        return int(m.group(0)) if m else None

    def normalize_year(y):
        if not y:
            return None
        if isinstance(y, int):
            return y
        s = str(y)
        m = re.search(r"\d{4}", s)
        return int(m.group(0)) if m else None

    if sort_by == "year":
        # extract year or use -inf/+inf for missing depending on order
        if sort_order == "asc":
            results.sort(
                key=lambda x: normalize_year(x.get("year")) if normalize_year(x.get("year")) is not None else float("inf"),
                reverse=False
            )
        else:  # desc
            results.sort(
                key=lambda x: normalize_year(x.get("year")) if normalize_year(x.get("year")) is not None else float("-inf"),
                reverse=True
            )

    else:
        # default fallback: keep existing behaviour (newest first)
        results.sort(key=lambda x: (0 if normalize_year(x.get("year")) is not None else 1, -(normalize_year(x.get("year")) or 0)))

    total = len(results)
    start = (page - 1) * per_page
    end = start + per_page

    return {
        "publications": results[start:end],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
        "filters_applied": ", ".join(filter_info) if filter_info else "none"
    }

@app.get("/categories")
def get_categories():
    cats = []
    for v in publications_db.values():
        cats.extend(v.get("categories", []))
    counts = Counter(cats)
    return {
        "categories": [{"name": k, "count": v} for k, v in counts.most_common()],
        "total_unique_categories": len(counts)
    }

@app.get("/journals")
def get_journals():
    journals = [v.get("journal", "Unknown") for v in publications_db.values()]
    journal_counts = Counter(journals)
    return {
        "journals": [{"name": journal, "count": count} for journal, count in journal_counts.most_common()],
        "total_unique_journals": len(journal_counts)
    }

@app.get("/authors")
def get_authors(limit: int = 100):
    """
    Return top authors (name + count). Useful for typeahead/autocomplete.
    """
    authors = []
    for v in publications_db.values():
        authors.extend(v.get("authors", []))
    author_counts = Counter(authors)
    top = author_counts.most_common(limit)
    return {
        "authors": [{"name": author, "count": count} for author, count in top],
        "total_unique_authors": len(author_counts)
    }

@app.get("/stats")
def get_stats():
    years = [v.get("year") for v in publications_db.values() if v.get("year")]
    journals = [v.get("journal") for v in publications_db.values() if v.get("journal")]
    categories = []
    authors = []
    
    for v in publications_db.values():
        categories.extend(v.get("categories", []))
        authors.extend(v.get("authors", []))
    
    # PDF statistics
    total_pdfs = sum(1 for v in publications_db.values() if v.get("pdf_downloaded", False))
    total_pdf_size = sum(v.get("pdf_file_size", 0) for v in publications_db.values() if v.get("pdf_file_size"))
    
    # Calculate statistics
    category_counts = Counter(categories).most_common(10)
    journal_counts = Counter(journals).most_common(10)
    author_counts = Counter(authors).most_common(10)
    
    return {
        "total_publications": len(publications_db),
        "year_range": {
            "min": min(years) if years else None, 
            "max": max(years) if years else None
        },
        "pdf_statistics": {
            "total_pdfs_downloaded": total_pdfs,
            "pdf_success_rate": f"{(total_pdfs / len(publications_db) * 100):.1f}%" if publications_db else "0%",
            "total_pdf_size_mb": f"{(total_pdf_size / (1024*1024)):.1f}" if total_pdf_size else "0"
        },
        "top_categories": [{"name": cat, "count": count} for cat, count in category_counts],
        "top_journals": [{"name": journal, "count": count} for journal, count in journal_counts],
        "top_authors": [{"name": author, "count": count} for author, count in author_counts],
        "categories_count": len(set(categories)),
        "journals_count": len(set(journals)),
        "authors_count": len(set(authors))
    }

@app.get("/pdf/{pmcid}")
def download_pdf(pmcid: str):
    """Download PDF file for a specific PMC ID"""
    if pmcid not in publications_db:
        raise HTTPException(404, f"PMC ID {pmcid} not found")
    
    publication = publications_db[pmcid]
    
    if not publication.get("pdf_downloaded", False):
        raise HTTPException(404, f"PDF not available for {pmcid}")
    
    pdf_path = publication.get("pdf_file_path")
    if not pdf_path or not Path(pdf_path).exists():
        raise HTTPException(404, f"PDF file not found for {pmcid}")
    
    return FileResponse(
        path=pdf_path,
        media_type='application/pdf',
        filename=f"{pmcid}.pdf"
    )

@app.get("/pdf/info/{pmcid}")
def get_pdf_info(pmcid: str):
    """Get PDF information for a specific PMC ID"""
    if pmcid not in publications_db:
        raise HTTPException(404, f"PMC ID {pmcid} not found")
    
    publication = publications_db[pmcid]
    
    return {
        "pmcid": pmcid,
        "pdf_downloaded": publication.get("pdf_downloaded", False),
        "pdf_file_size": publication.get("pdf_file_size"),
        "pdf_file_path": publication.get("pdf_file_path"),
        "download_source": publication.get("download_source"),
        "download_timestamp": publication.get("download_timestamp"),
        "pdf_error": publication.get("pdf_error") if not publication.get("pdf_downloaded") else None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
