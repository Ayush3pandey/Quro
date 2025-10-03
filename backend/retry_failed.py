import json
import logging
from datetime import datetime
from pathlib import Path
import sys

# Import your PMCIngestionTool
from ingestion import PMCIngestionTool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def retry_failed_entries():
    """Retry only the failed entries from publications.json"""
    
    # Load current publications
    with open('publications.json', 'r', encoding='utf-8') as f:
        publications_db = json.load(f)
    
    # Find failed entries
    failed_pmcs = []
    for pmcid, data in publications_db.items():
        if not data.get('fetch_success', True) or '[ERROR]' in data.get('title', ''):
            failed_pmcs.append(pmcid)
    
    logger.info(f"Found {len(failed_pmcs)} failed PMC IDs to retry: {failed_pmcs}")
    
    if not failed_pmcs:
        logger.info("No failed entries to retry!")
        return
    
    # Initialize ingestion tool
    ingestion_tool = PMCIngestionTool()
    retry_success = 0
    
    # Retry each failed PMC
    for pmcid in failed_pmcs:
        logger.info(f"\n🔄 Retrying {pmcid}...")
        try:
            # Retry the metadata fetch
            metadata = ingestion_tool.fetch_publication_metadata(pmcid)
            
            # Update the database
            publications_db[pmcid] = metadata
            
            if metadata.get('fetch_success', False):
                retry_success += 1
                logger.info(f"✅ Successfully retried {pmcid}")
            else:
                logger.warning(f"❌ Still failed: {pmcid}")
                
        except Exception as e:
            logger.error(f"❌ Exception retrying {pmcid}: {e}")
    
    # Save updated database
    with open('publications.json', 'w', encoding='utf-8') as f:
        json.dump(publications_db, f, indent=2, ensure_ascii=False, default=str)
    
    logger.info(f"\n🎉 Retry completed!")
    logger.info(f"✅ Successfully fixed: {retry_success}/{len(failed_pmcs)}")
    logger.info(f"📁 Updated database saved to publications.json")

if __name__ == "__main__":
    retry_failed_entries()
