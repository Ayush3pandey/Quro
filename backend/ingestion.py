import csv
import json
import time
import re
import logging
import os
import requests
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from Bio import Entrez
import pandas as pd
from metapub import PubMedFetcher
from dotenv import load_dotenv
from pathlib import Path
from tqdm import tqdm
from collections import Counter

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/ingestion_pmc.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
PUBMED_EMAIL = os.getenv('PUBMED_EMAIL', 'your-email@example.com')
RATE_LIMIT_DELAY = float(os.getenv('RATE_LIMIT_DELAY', '1.5'))
MAX_RETRIES = int(os.getenv('MAX_RETRIES', '3'))
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB limit

# Set email for NCBI API
Entrez.email = PUBMED_EMAIL

class PMCIngestionTool:
    def __init__(self):
        self.fetch = PubMedFetcher()
        self.failed_pmcids = []
        self.processed_count = 0
        self.total_count = 0
        self.start_time = None
        self.pdf_success_count = 0
        self.pdf_failed_count = 0
        
        # Create necessary directories
        Path('logs').mkdir(exist_ok=True)
        Path('temp').mkdir(exist_ok=True)
        Path('pdfs').mkdir(exist_ok=True)

    def extract_pmc_id(self, url_or_id: str) -> Optional[str]:
        """Extract PMC ID from URL or text"""
        if not url_or_id or pd.isna(url_or_id):
            return None
        
        url_or_id = str(url_or_id).strip()
        
        # PMC ID extraction patterns
        patterns = [
            r'pmc/articles/PMC(\d+)',
            r'PMC(\d+)',
            r'pmc(\d+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url_or_id, re.IGNORECASE)
            if match:
                return f"PMC{match.group(1)}"
        
        return None

    def pmc_to_pmid_converter(self, pmc_id: str) -> Optional[str]:
        """Convert PMC ID to PMID using NCBI ID Converter API"""
        try:
            clean_pmc = pmc_id.replace('PMC', '').strip()
            api_url = f"https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids=PMC{clean_pmc}&format=json"
            
            response = requests.get(api_url, timeout=30, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; PubMed Research Tool)'
            })
            
            if response.status_code == 200:
                data = response.json()
                if 'records' in data and len(data['records']) > 0:
                    record = data['records'][0]
                    if 'pmid' in record and record['pmid']:
                        converted_pmid = record['pmid']
                        logger.info(f"✓ Converted {pmc_id} → PMID {converted_pmid}")
                        return converted_pmid
                    else:
                        logger.warning(f"No PMID found for {pmc_id}")
                else:
                    logger.warning(f"No records found for {pmc_id}")
            else:
                logger.error(f"API error for {pmc_id}: Status {response.status_code}")
                
        except Exception as e:
            logger.error(f"Error converting {pmc_id} to PMID: {str(e)}")
        
        return None

    def download_pmc_pdf(self, pmc_id: str) -> Dict:
        """Download PDF for PMC article"""
        try:
            pdf_filename = f"{pmc_id}.pdf"
            pdf_path = Path('pdfs') / pdf_filename
            
            # Check if already exists and is valid
            if pdf_path.exists() and pdf_path.stat().st_size > 1000:
                logger.info(f"✓ PDF already exists for {pmc_id}")
                return {
                    'success': True,
                    'file_path': str(pdf_path),
                    'file_size': pdf_path.stat().st_size,
                    'source': 'already_exists'
                }
            
            # PMC PDF download URLs (in order of preference)
            pdf_sources = [
                f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmc_id}/pdf/",
                f"https://europepmc.org/articles/{pmc_id.lower()}?pdf=render",
                f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmc_id}/pdf/{pmc_id}.pdf"
            ]
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (compatible; Research PDF Downloader)',
                'Accept': 'application/pdf,*/*'
            }
            
            # Try each PDF source
            for i, pdf_url in enumerate(pdf_sources):
                try:
                    logger.info(f"Trying PDF source {i+1} for {pmc_id}")
                    
                    response = requests.get(pdf_url, headers=headers, timeout=60, stream=True)
                    
                    if response.status_code == 200:
                        # Check if it's actually a PDF
                        content_type = response.headers.get('content-type', '').lower()
                        first_chunk = next(response.iter_content(10), b'')
                        
                        if 'pdf' in content_type or first_chunk.startswith(b'%PDF'):
                            # Check file size
                            content_length = response.headers.get('content-length')
                            if content_length and int(content_length) > MAX_FILE_SIZE:
                                logger.warning(f"PDF too large for {pmc_id}: {content_length} bytes")
                                continue
                            
                            # Download the file
                            total_size = 0
                            with open(pdf_path, 'wb') as f:
                                f.write(first_chunk)
                                total_size += len(first_chunk)
                                
                                for chunk in response.iter_content(8192):
                                    if total_size > MAX_FILE_SIZE:
                                        break
                                    f.write(chunk)
                                    total_size += len(chunk)
                            
                            # Verify download
                            if pdf_path.exists() and pdf_path.stat().st_size > 1000:
                                file_size = pdf_path.stat().st_size
                                logger.info(f"✓ Downloaded PDF for {pmc_id} ({file_size:,} bytes)")
                                self.pdf_success_count += 1
                                return {
                                    'success': True,
                                    'file_path': str(pdf_path),
                                    'file_size': file_size,
                                    'source': pdf_url
                                }
                            else:
                                # Remove failed download
                                if pdf_path.exists():
                                    pdf_path.unlink()
                        else:
                            logger.debug(f"Not a PDF response for {pmc_id} from source {i+1}")
                    
                except Exception as e:
                    logger.debug(f"PDF download error for {pmc_id} from source {i+1}: {str(e)}")
                    if pdf_path.exists():
                        pdf_path.unlink()
                    continue
            
            # All sources failed
            logger.warning(f"✗ All PDF sources failed for {pmc_id}")
            self.pdf_failed_count += 1
            return {
                'success': False,
                'error': 'All download sources failed'
            }
            
        except Exception as e:
            logger.error(f"PDF download error for {pmc_id}: {str(e)}")
            self.pdf_failed_count += 1
            return {
                'success': False,
                'error': str(e)
            }

    def get_categories_from_mesh_terms(self, mesh_terms: List[str]) -> List[str]:
        """Enhanced categorization based on MeSH terms"""
        category_mapping = {
            'space biology': [
                'space', 'spaceflight', 'astronaut', 'space station', 'mars', 'lunar', 
                'orbital', 'international space station', 'iss', 'shuttle', 'mission',
                'space flight', 'aerospace', 'extraterrestrial'
            ],
            'microgravity': [
                'microgravity', 'weightlessness', 'zero gravity', 'reduced gravity', 
                'μg', 'simulated microgravity', 'gravitational unloading', 'hypogravity'
            ],
            'plant biology': [
                'plant', 'botany', 'photosynthesis', 'chlorophyll', 'seed', 'root', 'leaf', 
                'flower', 'arabidopsis', 'seedling', 'germination', 'phytochrome', 'crops'
            ],
            'cell biology': [
                'cell', 'cellular', 'cytoplasm', 'nucleus', 'organelle', 'mitochondria',
                'endoplasmic reticulum', 'golgi', 'cytoskeleton', 'membrane', 'apoptosis'
            ],
            'molecular biology': [
                'molecular', 'dna', 'rna', 'protein', 'gene', 'genome', 'transcription',
                'translation', 'mrna', 'expression', 'sequence', 'telomere', 'terra'
            ],
            'radiation biology': [
                'radiation', 'cosmic ray', 'solar particle', 'radioprotection', 'ionizing',
                'gamma ray', 'proton radiation', 'space radiation', 'galactic cosmic ray'
            ],
            'physiology': [
                'physiology', 'physiological', 'homeostasis', 'metabolism', 'metabolic',
                'function', 'adaptation', 'response', 'biomarker'
            ],
            'bone biology': [
                'bone', 'calcium', 'osteoporosis', 'skeletal', 'osteoblast', 'osteoclast',
                'mineralization', 'ossification', 'fracture', 'osteopenia'
            ],
            'muscle biology': [
                'muscle', 'muscular', 'myocyte', 'contraction', 'strength', 'fiber',
                'myosin', 'actin', 'sarcomere', 'atrophy', 'exercise'
            ],
            'cardiovascular': [
                'heart', 'blood', 'circulation', 'cardiovascular', 'vascular', 'artery',
                'vein', 'pressure', 'cardiac', 'vessel', 'endothelial'
            ],
            'neuroscience': [
                'brain', 'neuron', 'nervous system', 'cognition', 'behavior', 'neural',
                'neurotransmitter', 'synapse', 'cortex', 'neurological'
            ]
        }
        
        categories = set()
        
        if not mesh_terms:
            return ['general biology']
        
        for mesh_term in mesh_terms:
            mesh_lower = mesh_term.lower()
            for category, keywords in category_mapping.items():
                if any(keyword in mesh_lower for keyword in keywords):
                    categories.add(category)
        
        return list(categories) if categories else ['general biology']

    def fetch_publication_metadata(self, pmc_id: str, retry_count=0) -> Dict:
        """Fetch comprehensive publication metadata and download PDF"""
        try:
            logger.info(f"Fetching metadata for PMC ID: {pmc_id}")
            
            # First, convert PMC to PMID to get full metadata
            pmid = self.pmc_to_pmid_converter(pmc_id)
            
            if not pmid:
                raise Exception(f"Could not convert {pmc_id} to PMID")
            
            # Use metapub for basic metadata with the PMID
            article = self.fetch.article_by_pmid(pmid)
            
            # Initialize extended metadata
            mesh_terms = []
            keywords = []
            publication_types = []
            doi = None
            
            # Get extended metadata using Entrez with PMID
            try:
                handle = Entrez.efetch(
                    db="pubmed", 
                    id=pmid, 
                    rettype="medline", 
                    retmode="text"
                )
                medline_data = handle.read()
                handle.close()
                
                # Parse MEDLINE format
                for line in medline_data.split('\n'):
                    line = line.strip()
                    if line.startswith('MH  - '):
                        mesh_term = line[6:].strip()
                        main_heading = mesh_term.split('/')[0]
                        mesh_terms.append(main_heading)
                    elif line.startswith('OT  - '):
                        keyword = line[6:].strip()
                        keywords.append(keyword)
                    elif line.startswith('PT  - '):
                        pub_type = line[6:].strip()
                        publication_types.append(pub_type)
                    elif line.startswith('AID - ') and 'doi' in line.lower():
                        doi_match = re.search(r'(10\.\d+/[^\s]+)', line)
                        if doi_match:
                            doi = doi_match.group(1)
                
            except Exception as e:
                logger.warning(f"Could not fetch extended metadata for PMC {pmc_id} (PMID {pmid}): {str(e)}")
            
            # Categorize based on MeSH terms and keywords
            all_terms = mesh_terms + keywords
            categories = self.get_categories_from_mesh_terms(all_terms)
            
            # Download PDF
            logger.info(f"Downloading PDF for {pmc_id}")
            pdf_result = self.download_pmc_pdf(pmc_id)
            
            # Build result - using PMC ID as the key
            result = {
                "pmcid": pmc_id,
                "pmid": pmid,  # Keep PMID for reference
                "title": article.title or "No title available",
                "authors": [str(author) for author in article.authors] if article.authors else ["Unknown"],
                "year": int(article.year) if article.year else 2020,
                "journal": article.journal or "Unknown Journal",
                "abstract": article.abstract or "No abstract available",
                "categories": categories,
                "pdf_url": f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmc_id}/",
                "doi": doi,
                "keywords": keywords[:10],  # Limit keywords
                "publication_type": publication_types,
                "mesh_terms": mesh_terms[:10],  # Store some MeSH terms
                "pdf_downloaded": pdf_result.get('success', False),
                "pdf_file_path": pdf_result.get('file_path') if pdf_result.get('success') else None,
                "pdf_file_size": pdf_result.get('file_size') if pdf_result.get('success') else None,
                "download_source": pdf_result.get('source') if pdf_result.get('success') else None,
                "download_timestamp": datetime.now().isoformat() if pdf_result.get('success') else None,
                "pdf_error": pdf_result.get('error') if not pdf_result.get('success') else None,
                "fetch_timestamp": datetime.now().isoformat(),
                "fetch_success": True
            }
            
            logger.info(f"✓ Successfully processed {pmc_id}: {result['title'][:50]}...")
            return result
            
        except Exception as e:
            error_msg = f"Error fetching {pmc_id}: {str(e)}"
            logger.error(error_msg)
            
            if retry_count < MAX_RETRIES:
                logger.info(f"Retrying {pmc_id} (attempt {retry_count + 1}/{MAX_RETRIES})")
                time.sleep(RATE_LIMIT_DELAY * (retry_count + 1))
                return self.fetch_publication_metadata(pmc_id, retry_count + 1)
            
            self.failed_pmcids.append({
                'pmcid': pmc_id,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
            
            # Return error placeholder
            return {
                "pmcid": pmc_id,
                "pmid": None,
                "title": f"[ERROR] Failed to fetch: {pmc_id}",
                "authors": ["Unknown"],
                "year": 2020,
                "journal": "Error - Failed to fetch",
                "abstract": f"Failed to fetch abstract. Error: {error_msg}",
                "categories": ["error"],
                "pdf_url": f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmc_id}/",
                "doi": None,
                "keywords": [],
                "publication_type": ["Error"],
                "mesh_terms": [],
                "pdf_downloaded": False,
                "pdf_file_path": None,
                "pdf_file_size": None,
                "download_source": None,
                "download_timestamp": None,
                "pdf_error": "Metadata fetch failed",
                "fetch_timestamp": datetime.now().isoformat(),
                "fetch_success": False,
                "error_message": error_msg
            }

    def save_progress(self, publications_db: Dict, output_path: str):
        """Save progress with backup"""
        try:
            # Create backup of existing file
            if os.path.exists(output_path):
                backup_path = f"{output_path}.backup.{int(time.time())}"
                os.rename(output_path, backup_path)
                logger.info(f"Created backup: {backup_path}")
            
            # Save current progress
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(publications_db, f, indent=2, ensure_ascii=False, default=str)
            
            logger.info(f"✓ Progress saved: {len(publications_db)} records in {output_path}")
            
        except Exception as e:
            logger.error(f"Error saving progress: {str(e)}")

    def process_csv_to_json(self, csv_file_path: str, output_json_path: str) -> Dict:
        """Main processing function"""
        
        # Load existing data if it exists (for resuming)
        publications_db = {}
        if os.path.exists(output_json_path):
            try:
                with open(output_json_path, 'r', encoding='utf-8') as f:
                    publications_db = json.load(f)
                logger.info(f"Loaded existing database with {len(publications_db)} entries")
            except Exception as e:
                logger.warning(f"Could not load existing data: {e}")
        
        # Load CSV
        if not os.path.exists(csv_file_path):
            logger.error(f"CSV file not found: {csv_file_path}")
            return None
        
        try:
            df = pd.read_csv(csv_file_path)
            logger.info(f"✓ Loaded CSV with {len(df)} records")
            logger.info(f"CSV columns: {list(df.columns)}")
        except Exception as e:
            logger.error(f"Error reading CSV: {str(e)}")
            return None
        
        # Extract PMC IDs from all columns
        pmc_ids = set()
        for col in df.columns:
            for val in df[col]:
                pmc_id = self.extract_pmc_id(val)
                if pmc_id:
                    pmc_ids.add(pmc_id)
        
        pmc_ids = sorted(pmc_ids)
        self.total_count = len(pmc_ids)
        self.start_time = datetime.now()
        
        logger.info(f"Found {self.total_count} unique PMC IDs to process")
        logger.info(f"Already have {len(publications_db)} records")
        
        # Process each PMC ID
        with tqdm(total=self.total_count, desc="Processing PMC publications", initial=len(publications_db)) as pbar:
            for i, pmc_id in enumerate(pmc_ids):
                # Skip if already processed successfully
                if (pmc_id in publications_db and 
                    publications_db[pmc_id].get('fetch_success', True) and
                    '[ERROR]' not in publications_db[pmc_id].get('title', '')):
                    continue
                
                logger.info(f"Processing {pmc_id} ({i+1}/{self.total_count})")
                
                # Fetch metadata and download PDF
                metadata = self.fetch_publication_metadata(pmc_id)
                publications_db[pmc_id] = metadata
                
                self.processed_count += 1
                pbar.update(1)
                
                # Rate limiting
                time.sleep(RATE_LIMIT_DELAY)
                
                # Save progress periodically
                if (i + 1) % 25 == 0:
                    self.save_progress(publications_db, output_json_path)
                    self.print_progress_summary(publications_db)
        
        # Final save
        self.save_progress(publications_db, output_json_path)
        
        # Generate final report
        self.generate_final_report(publications_db, output_json_path)
        
        return publications_db

    def print_progress_summary(self, publications_db):
        """Print progress summary"""
        successful = sum(1 for pub in publications_db.values() if pub.get('fetch_success', True))
        failed = len(self.failed_pmcids)
        
        logger.info("\n" + "="*60)
        logger.info("PROGRESS SUMMARY")
        logger.info("="*60)
        logger.info(f"Processed: {self.processed_count}")
        logger.info(f"Successful: {successful}")
        logger.info(f"Failed: {failed}")
        logger.info(f"PDFs Downloaded: {self.pdf_success_count}")
        logger.info(f"PDF Failures: {self.pdf_failed_count}")
        logger.info("="*60 + "\n")

    def generate_final_report(self, publications_db: Dict, output_path: str):
        """Generate comprehensive final report"""
        total_time = datetime.now() - self.start_time
        
        # Statistics
        total_pubs = len(publications_db)
        successful_pubs = sum(1 for pub in publications_db.values() 
                             if pub.get('fetch_success', True))
        error_pubs = total_pubs - successful_pubs
        
        # PDF statistics
        successful_pdfs = sum(1 for pub in publications_db.values() 
                             if pub.get('pdf_downloaded', False))
        
        # Category analysis
        all_categories = []
        for pub in publications_db.values():
            if pub.get('fetch_success', True):
                all_categories.extend(pub.get('categories', []))
        
        category_counts = Counter(all_categories).most_common(15)
        
        # Print final summary
        logger.info("\n" + "="*80)
        logger.info("🎉 PMC INGESTION WITH PDF DOWNLOADS COMPLETED!")
        logger.info("="*80)
        logger.info(f"⏱️  Total time: {total_time}")
        logger.info(f"📊 Total PMC publications: {total_pubs}")
        logger.info(f"✅ Successful metadata: {successful_pubs} ({successful_pubs/total_pubs*100:.1f}%)")
        logger.info(f"❌ Metadata errors: {error_pubs}")
        logger.info(f"📄 PDFs downloaded: {successful_pdfs} ({successful_pdfs/total_pubs*100:.1f}%)")
        logger.info(f"📁 Database saved to: {output_path}")
        logger.info(f"📁 PDFs saved in: pdfs/ folder")
        logger.info("="*80)
        
        # Show top categories
        if category_counts:
            logger.info("\n📊 Top Categories:")
            for cat, count in category_counts[:10]:
                logger.info(f"   {cat}: {count}")

def main():
    """Main execution function"""
    csv_path = os.getenv('CSV_FILE_PATH', 'data/SB_publication_PMC.csv')
    json_path = os.getenv('JSON_OUTPUT_PATH', 'publications.json')
    
    logger.info("🚀 Starting PMC-based ingestion with PDF downloads...")
    logger.info(f"📂 CSV file: {csv_path}")
    logger.info(f"💾 Output JSON: {json_path}")
    logger.info(f"📄 PDFs will be saved to: pdfs/")
    logger.info(f"📧 PubMed email: {PUBMED_EMAIL}")
    logger.info(f"⏱️  Rate limit: {RATE_LIMIT_DELAY}s between requests")
    
    # Initialize and run
    ingestion_tool = PMCIngestionTool()
    
    result = ingestion_tool.process_csv_to_json(csv_path, json_path)
    
    if result:
        successful_pdfs = sum(1 for pub in result.values() if pub.get('pdf_downloaded', False))
        logger.info("🎉 PMC ingestion with PDF downloads completed successfully!")
        logger.info(f"✅ Final database contains {len(result)} publications")
        logger.info(f"📄 Downloaded {successful_pdfs} PDFs")
    else:
        logger.error("❌ Ingestion failed!")

if __name__ == "__main__":
    main()
