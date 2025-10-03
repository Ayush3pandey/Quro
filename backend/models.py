from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum

class DownloadSource(str, Enum):
    PMC_OA = "PMC_OA"
    PMC_AUTHOR = "PMC_Author"
    PUBMED_FREE = "PubMed_Free"
    INSTITUTION = "Institution"
    DIRECT_LINK = "Direct_Link"
    FAILED = "Failed"

class Publication(BaseModel):
    title: str
    authors: List[str] = Field(default_factory=list)
    year: int = Field(default=2020, ge=1950, le=2030)
    journal: str = Field(default="Unknown Journal")
    abstract: str = Field(default="No abstract available")
    categories: List[str] = Field(default_factory=list)
    pdf_url: str
    pmid: str
    doi: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)
    publication_type: List[str] = Field(default_factory=list)
    pdf_downloaded: bool = Field(default=False)
    pdf_file_path: Optional[str] = None
    pdf_file_size: Optional[int] = None
    download_source: Optional[DownloadSource] = None
    download_timestamp: Optional[datetime] = None

class PublicationResponse(BaseModel):
    publications: List[Publication]
    total: int
    page: int
    per_page: int
    total_pages: int

class SearchResponse(PublicationResponse):
    query: str

class FilterResponse(PublicationResponse):
    filter_type: str
    filter_value: str

class DownloadStats(BaseModel):
    total_publications: int
    pdfs_downloaded: int
    pdfs_failed: int
    download_success_rate: float
    total_pdf_size_mb: float
    avg_pdf_size_mb: float

class StatsResponse(BaseModel):
    total_publications: int
    year_range: Dict[str, int]
    top_categories: List[Dict[str, Any]]
    top_journals: List[Dict[str, Any]]
    top_authors: List[Dict[str, Any]]
    categories_count: int
    journals_count: int
    download_stats: DownloadStats

class IngestionProgress(BaseModel):
    total_records: int
    processed_records: int
    failed_records: int
    downloaded_pdfs: int
    failed_pdfs: int
    current_pmid: Optional[str] = None
    status: str
    start_time: datetime
    estimated_completion: Optional[datetime] = None
    current_step: str = "processing_metadata"

class PDFDownloadResult(BaseModel):
    pmid: str
    success: bool
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    source: Optional[DownloadSource] = None
    error_message: Optional[str] = None
    download_time: float = 0.0
