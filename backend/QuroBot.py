"""
Unified Research Chatbot - Automatic Mode Switching
- RAG Database Mode: When no PDF is uploaded (default)
- PDF Analysis Mode: When user uploads a specific PDF
Author: Research Assistant AI
Date: October 2025
"""

import os
import re
import json
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime

import pdfplumber
import requests
from qdrant_client import QdrantClient
from google import genai
from google.genai import types
from sentence_transformers import SentenceTransformer

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== Configuration ====================
QDRANT_URL="https://44e5dc8e-9bd5-436c-9922-6feb693fff2f.europe-west3-0.gcp.cloud.qdrant.io"

QDRANT_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.tnOMOdM-21R_H6RAUnPtpGPOlMwb7BR8oUQh_jbx2Hs"

COLLECTION_NAME="research_papers"
SERP_API_KEY ="9f76f4c571130c56e879920970315ed75379cc2f41fbbc2d287b105163cf873d"
GEMINI_API_KEY = "AIzaSyDlV6U3s8DYiwl7UI8I0R-vebYKTLtWqdU"


# RAG Configuration
RETRIEVAL_LIMIT = 5
RELEVANCE_THRESHOLD = 0.65
INSUFFICIENT_SCORE_THRESHOLD = 0.70

# Initialize clients
gemini_client = genai.Client(api_key=GEMINI_API_KEY)
qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=30)
embedding_model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')

logger.info("Loaded sentence-transformers/all-mpnet-base-v2 embedding model")


# ==================== Data Classes ====================
@dataclass
class ChatMessage:
    """Represents a single chat message"""
    role: str
    content: str
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class Reference:
    """Research paper reference"""
    number: str
    url: Optional[str] = None
    doi: Optional[str] = None
    authors: Optional[str] = None
    citation_text: Optional[str] = None


@dataclass
class RetrievedChunk:
    """Retrieved chunk from Qdrant"""
    id: str
    text: str
    score: float
    metadata: Dict


@dataclass
class ExternalSource:
    """External search result"""
    title: str
    link: str
    snippet: str
    source_type: str = "external_search"
    reference_number: Optional[str] = None


@dataclass
class ChatbotResponse:
    """Unified chatbot response"""
    answer: str
    sources: List[str]
    method: str
    mode: str  # "rag" or "pdf"
    retrieved_chunks: List[RetrievedChunk] = field(default_factory=list)
    external_sources: List[ExternalSource] = field(default_factory=list)
    avg_retrieval_score: float = 0.0
    references_used: List[str] = field(default_factory=list)


# ==================== Chat History Manager ====================
class ChatHistory:
    """Manages conversation history"""
    
    def __init__(self, max_messages: int = 10):
        self.messages: List[ChatMessage] = []
        self.max_messages = max_messages
    
    def add_message(self, role: str, content: str):
        message = ChatMessage(role=role, content=content)
        self.messages.append(message)
        if len(self.messages) > self.max_messages:
            self.messages = self.messages[-self.max_messages:]
    
    def get_recent_context(self, num_messages: int = 4) -> str:
        recent = self.messages[-num_messages:] if len(self.messages) > num_messages else self.messages
        if not recent:
            return "No previous conversation."
        context = ""
        for msg in recent:
            context += f"{msg.role.upper()}: {msg.content}\n"
        return context
    
    def clear(self):
        self.messages = []
        logger.info("Chat history cleared")


# ==================== PDF Processor (for uploaded PDFs) ====================
class PDFProcessor:
    """Handles PDF text extraction and reference parsing"""
    
    @staticmethod
    def extract_pdf_content(pdf_path: str) -> Tuple[str, Dict[str, Reference]]:
        """Extract text and references from PDF using pdfplumber"""
        logger.info(f"Extracting content from PDF: {pdf_path}")
        text = ""
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    page_text = page.extract_text()
                    if page_text:
                        text += f"\n{page_text}"
            
            references = PDFProcessor._extract_references(text)
            logger.info(f"Extracted {len(references)} references from PDF")
            
            return text, references
            
        except Exception as e:
            logger.error(f"Error extracting PDF: {e}")
            raise
    
    @staticmethod
    def _extract_references(text: str) -> Dict[str, Reference]:
        """Extract references using multiple patterns"""
        references = {}
        
        # Pattern 1: [number] with URL
        url_pattern = r"\[(\d+)\][^\[]*?(https?://[^\s\]]+)"
        for match in re.finditer(url_pattern, text):
            ref_num, url = match.groups()
            references[ref_num] = Reference(number=ref_num, url=url)
        
        # Pattern 2: [number] with DOI
        doi_pattern = r"\[(\d+)\][^\[]*?doi[:\s]*(10\.\d{4,}/[^\s\],]+)"
        for match in re.finditer(doi_pattern, text, re.IGNORECASE):
            ref_num, doi = match.groups()
            if ref_num not in references:
                references[ref_num] = Reference(number=ref_num, doi=doi, url=f"https://doi.org/{doi}")
            else:
                references[ref_num].doi = doi
        
        # Pattern 3: Extract citation context
        for ref_num in list(references.keys()):
            pattern = rf"\[{ref_num}\][^\[]*?(?:[\.\n]|\[\d+\])"
            matches = re.findall(pattern, text)
            if matches:
                references[ref_num].citation_text = matches[0][:200]
        
        return references


# ==================== Qdrant Retriever (for RAG mode) ====================
class QdrantRetriever:
    """Handles retrieval from Qdrant Cloud vector database"""
    
    def __init__(self, client: QdrantClient, collection_name: str, embedding_model: SentenceTransformer):
        self.client = client
        self.collection_name = collection_name
        self.embedding_model = embedding_model
        logger.info(f"Initialized QdrantRetriever for collection: {collection_name}")
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding using SentenceTransformer"""
        try:
            embedding = self.embedding_model.encode(text, convert_to_tensor=False)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            raise
    
    def retrieve(self, query: str, limit: int = RETRIEVAL_LIMIT, 
                score_threshold: float = RELEVANCE_THRESHOLD) -> Tuple[List[RetrievedChunk], float]:
        """Retrieve relevant chunks from Qdrant Cloud"""
        logger.info(f"Retrieving chunks for query: {query[:100]}...")
        
        try:
            query_embedding = self.generate_embedding(query)
            
            search_results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                limit=limit,
                score_threshold=score_threshold
            )
            
            chunks = []
            total_score = 0.0
            
            for result in search_results:
                text_content = result.payload.get("chunk_text", "")
                
                chunk = RetrievedChunk(
                    id=str(result.id),
                    text=text_content,
                    score=result.score,
                    metadata=result.payload
                )
                chunks.append(chunk)
                total_score += result.score
            
            avg_score = total_score / len(chunks) if chunks else 0.0
            logger.info(f"Retrieved {len(chunks)} chunks with avg score: {avg_score:.3f}")
            
            return chunks, avg_score
            
        except Exception as e:
            logger.error(f"Error retrieving from Qdrant: {e}")
            return [], 0.0


# ==================== SERP Searcher ====================
class SERPSearcher:
    """Handles external search via SERP API"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://serpapi.com/search"
    
    def search_google_scholar(self, query: str, num_results: int = 3) -> List[ExternalSource]:
        """Search Google Scholar for additional sources"""
        logger.info(f"Performing external search: {query[:100]}...")
        
        params = {
            "engine": "google_scholar",
            "q": query,
            "api_key": self.api_key,
            "num": num_results
        }
        
        try:
            response = requests.get(self.base_url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            sources = []
            for result in data.get("organic_results", [])[:num_results]:
                sources.append(ExternalSource(
                    title=result.get("title", "Unknown"),
                    link=result.get("link", ""),
                    snippet=result.get("snippet", "No description")
                ))
            
            logger.info(f"Found {len(sources)} external sources")
            return sources
            
        except Exception as e:
            logger.error(f"External search failed: {e}")
            return []
    
    def lookup_references(self, references: Dict[str, Reference], 
                         ref_numbers: List[str], query: str) -> List[ExternalSource]:
        """Look up multiple references"""
        logger.info(f"Looking up references: {ref_numbers}")
        
        reference_sources = []
        
        for ref_num in ref_numbers:
            if ref_num not in references:
                continue
            
            ref = references[ref_num]
            search_query = ""
            
            if ref.url:
                search_query = ref.url
            elif ref.doi:
                search_query = ref.doi
            elif ref.citation_text:
                search_query = f"{ref.citation_text[:100]} {query}"
            else:
                continue
            
            results = self.search_google_scholar(search_query, num_results=1)
            
            if results:
                reference_sources.append(ExternalSource(
                    title=results[0].title,
                    link=results[0].link,
                    snippet=results[0].snippet,
                    source_type="reference",
                    reference_number=ref_num
                ))
                logger.info(f"Found reference [{ref_num}]")
        
        return reference_sources


# ==================== Gemini Agent ====================
class GeminiAgent:
    """Handles Gemini API interactions"""
    
    def __init__(self, model_name: str = "gemini-2.5-flash"):
        self.model_name = model_name
        logger.info(f"Initialized GeminiAgent with {model_name}")
    
    def answer_from_chunks(self, query: str, chunks: List[RetrievedChunk], 
                      chat_history: str, paper_mapping: Dict[str, int]) -> Tuple[str, bool]:
        """Generate answer from retrieved chunks (RAG mode) with paper-level citations"""
        logger.info("Generating answer from retrieved chunks")
        
        # Build context with paper IDs instead of chunk numbers
        context_parts = []
        for chunk in chunks:
            paper_title = chunk.metadata.get("title", "Unknown")
            paper_id = paper_mapping.get(paper_title, 0)
            context_parts.append(f"[Paper {paper_id}]\n{chunk.text}")
        
        context = "\n\n---\n\n".join(context_parts)
        
        prompt = f"""You are an expert research assistant with access to a database of 500+ research papers. Answer the user's query using the retrieved context and conversation history.

    {chat_history}

    Retrieved Context from Database:
    {context}

    Current Query: {query}

    CRITICAL CITATION INSTRUCTIONS:
    - Use ONLY numeric citations like [1], [2], [3] etc.
    - Do NOT write "Chunk 1" or "according to Chunk" - use ONLY [1], [2] format
    - Cite the paper number shown in [Paper N] tags in the context
    - Place citations immediately after the relevant statement
    - Multiple citations should be [1][2] or [1,2] format
    - EVERY factual statement MUST have a citation

    CONTENT INSTRUCTIONS:
    - Paraphrase and synthesize information in your own words (do NOT copy verbatim)
    - Use clear, accessible language while maintaining scientific accuracy
    - If the retrieved context fully answers the query, provide a comprehensive response
    - If information is incomplete or insufficient, state: "INSUFFICIENT: The retrieved information does not provide complete details about this."
    - Consider the conversation history for context
    - Be specific about what is covered and what isn't

    Example of correct citation format:
    "Reduced workload in microgravity is a primary cause of muscle loss [1][3]. This affects lower limb muscles significantly [2]."

    Answer with numeric citations [N]:"""
        
        response = gemini_client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=1500
            )
        )
        
        answer = response.text
        is_sufficient = "INSUFFICIENT" not in answer
        
        return answer, is_sufficient

    
    def answer_from_paper(self, paper_text: str, query: str, chat_history: str) -> Tuple[str, bool]:
        """Generate answer from uploaded PDF paper"""
        logger.info("Generating answer from uploaded paper")
        
        prompt = f"""You are an expert research assistant analyzing a scientific paper. Answer the query using ONLY the information explicitly stated in the provided paper text.

{chat_history}

Research Paper Excerpt:
{paper_text}

User Query: {query}

CRITICAL INSTRUCTIONS:
- Paraphrase and synthesize information in your own words (do NOT copy verbatim)
- Use clear, accessible language while maintaining scientific accuracy
- If the paper provides information, give a detailed answer
- If information is incomplete or missing, state: "INSUFFICIENT: The paper does not provide complete information about this."
- Be specific about what is and isn't covered

Answer (paraphrased synthesis):"""
        
        response = gemini_client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=1500
            )
        )
        
        answer = response.text
        is_sufficient = "INSUFFICIENT" not in answer
        
        return answer, is_sufficient
    
    def assess_information_sufficiency(self, query: str, context_preview: str, 
                                      initial_answer: str) -> Dict:
        """Assess if information is sufficient"""
        logger.info("Assessing information sufficiency")
        
        prompt = f"""Analyze if the provided context provides SUFFICIENT information to fully answer the user's query.

User Query: {query}

Context Preview:
{context_preview}...

Generated Answer:
{initial_answer}

Evaluation Criteria:
- If answer is comprehensive and directly addresses the query → SUFFICIENT
- If answer explicitly states "INSUFFICIENT" or information is missing → INSUFFICIENT
- If context contains relevant information but answer is vague → SUFFICIENT

Respond in JSON:
{{
  "is_sufficient": true/false,
  "reasoning": "brief explanation",
  "confidence": "high|medium|low"
}}"""
        
        response = gemini_client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json"
            )
        )
        
        try:
            assessment = json.loads(response.text)
            logger.info(f"Assessment: {assessment.get('is_sufficient')} - {assessment.get('reasoning')}")
            return assessment
        except json.JSONDecodeError:
            logger.warning("Failed to parse assessment")
            return {"is_sufficient": True, "reasoning": "Parse error", "confidence": "low"}
    
    def synthesize_multi_source_answer(self, query: str, primary_context: str, 
                                      external_sources: List[ExternalSource],
                                      chat_history: str, mode: str) -> str:
        """Synthesize answer from multiple sources"""
        logger.info(f"Synthesizing answer with external sources (mode: {mode})")
        
        external_context = "\n\n".join([
            f"[External Source {i+1}]\nTitle: {src.title}\nLink: {src.link}\nContent: {src.snippet}"
            for i, src in enumerate(external_sources)
        ])
        
        source_label = "Paper" if mode == "rag" else "Paper"
        
        prompt = f"""You are an expert research assistant synthesizing information from multiple sources.

{chat_history}

Primary Source ({source_label}):
{primary_context}

External Sources:
{external_context}

Current Query: {query}

CITATION RULES:
- Use [1], [2], [3] format for ALL citations (numeric only)
- Use [Paper] citations ONLY when referring to database papers
- Use [External-N] when citing external sources  
- DO NOT write "Chunk" or "Database Chunk" - use [1], [2] format
- Cite after EVERY claim
- Paraphrase all information
- Provide comprehensive, well-structured answer

Synthesized Answer with Citations:"""
        
        response = gemini_client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=2048
            )
        )
        
        return response.text
    
    def optimize_search_query(self, query: str, chat_history: str) -> str:
        """Optimize query for external search"""
        prompt = f"""Given the conversation history and current query, generate an optimized search query for Google Scholar.

{chat_history}

Current Query: {query}

Respond with ONLY the search query, no explanations.

Optimized Query:"""
        
        response = gemini_client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=100
            )
        )
        
        return response.text.strip() if response.text else query
    def expand_query_with_context(self, query: str, chat_history: str) -> str:
        """Expand vague queries using conversation context"""
        logger.info("Expanding query with conversation context")
        
        # Check if query is vague/contextual
        query_lower = query.lower()
        vague_indicators = [
            'it', 'this', 'that', 'tell me more', 'what about', 'how about',
            'explain', 'elaborate', 'continue', 'go on', 'more details',
            'what else', 'anything else'
        ]
        
        is_vague = any(indicator in query_lower for indicator in vague_indicators)
        
        if not is_vague or not chat_history or chat_history == "No previous conversation.":
            return query  # Query is specific, use as-is
        
        prompt = f"""Given the conversation history, rewrite the user's current query to be a complete, standalone question that includes the necessary context.

    {chat_history}

    Current Query: {query}

    Instructions:
    - If the query references "it", "this", "that", replace with the actual topic from conversation
    - Make the query complete and searchable without needing conversation history
    - Keep the query concise (1-2 sentences max)
    - Preserve the user's intent and question type

    Respond with ONLY the expanded query, no explanations.

    Expanded Query:"""
        
        response = gemini_client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=100
            )
        )
        
        expanded = response.text.strip() if response.text else query
        logger.info(f"Query expanded: '{query}' → '{expanded}'")
        return expanded


# ==================== Unified Research Chatbot ====================
class UnifiedResearchChatbot:
    """Main chatbot that switches between RAG and PDF modes"""
    
    def __init__(self):
        """Initialize in RAG mode (default)"""
        logger.info("Initializing Unified Research Chatbot")
        
        self.chat_history = ChatHistory(max_messages=10)
        self.gemini_agent = GeminiAgent(model_name="gemini-2.5-flash")
        self.serp_searcher = SERPSearcher(SERP_API_KEY)
        
        # RAG mode components
        self.retriever = QdrantRetriever(qdrant_client, COLLECTION_NAME, embedding_model)
        
        # PDF mode components (initialized when PDF is uploaded)
        self.pdf_text = None
        self.pdf_references = None
        self.current_mode = "rag"
        
        logger.info("Chatbot ready in RAG mode")
    
    def upload_pdf(self, pdf_path: str):
        """Switch to PDF mode by uploading a document"""
        logger.info(f"Uploading PDF and switching to PDF mode: {pdf_path}")
        
        try:
            self.pdf_text, self.pdf_references = PDFProcessor.extract_pdf_content(pdf_path)
            self.current_mode = "pdf"
            self.chat_history.clear()  # Clear history when switching modes
            
            logger.info(f"✓ Switched to PDF mode. Found {len(self.pdf_references)} references")
            return True
        except Exception as e:
            logger.error(f"Failed to upload PDF: {e}")
            return False
        
    def _create_paper_mapping(self, chunks: List[RetrievedChunk]) -> Dict[str, int]:
        """Create mapping from paper titles to citation numbers (deduplicates papers)"""
        paper_titles = []
        paper_to_id = {}
        current_id = 1
        
        for chunk in chunks:
            paper_title = chunk.metadata.get("title", "Unknown")
            if paper_title not in paper_to_id:
                paper_to_id[paper_title] = current_id
                paper_titles.append(paper_title)
                current_id += 1
        
        return paper_to_id

    
    def reset_to_rag_mode(self):
        """Switch back to RAG database mode"""
        logger.info("Switching back to RAG mode")
        self.current_mode = "rag"
        self.pdf_text = None
        self.pdf_references = None
        self.chat_history.clear()
    
    def query(self, user_query: str) -> ChatbotResponse:
        """Main query method - automatically routes to correct mode"""
        logger.info(f"\n{'='*70}\nMode: {self.current_mode.upper()} | Query: {user_query}\n{'='*70}")
        
        if self.current_mode == "rag":
            return self._query_rag_mode(user_query)
        else:
            return self._query_pdf_mode(user_query)
    
    def _query_rag_mode(self, user_query: str) -> ChatbotResponse:
        """Handle query in RAG database mode"""
        history_context = self.chat_history.get_recent_context(num_messages=4)
        
        # STEP 1: Expand vague queries using conversation context
        expanded_query = self.gemini_agent.expand_query_with_context(user_query, history_context)
        
        # STEP 2: Retrieve from Qdrant using expanded query
        chunks, avg_score = self.retriever.retrieve(expanded_query)  # Use expanded_query here
        
        if not chunks:
            logger.warning("No chunks retrieved")
            return self._handle_no_retrieval(expanded_query)
        
        # Create paper mapping (deduplicates chunks from same paper)
        paper_mapping = self._create_paper_mapping(chunks)
        
        # STEP 3: Generate answer with paper-level citations (use original query for answer)
        answer, _ = self.gemini_agent.answer_from_chunks(
            user_query, chunks, history_context, paper_mapping  # Use original user_query here
        )
        
        # Assess sufficiency
        context_preview = "\n".join([chunk.text[:200] for chunk in chunks[:3]])
        assessment = self.gemini_agent.assess_information_sufficiency(
            user_query, context_preview, answer
        )
        
        needs_external = (
            not assessment.get("is_sufficient", True) or
            avg_score < INSUFFICIENT_SCORE_THRESHOLD
        )
        
        if not needs_external:
            response = ChatbotResponse(
                answer=answer,
                sources=self._format_rag_sources_deduplicated(chunks, paper_mapping),
                method="rag_only",
                mode="rag",
                retrieved_chunks=chunks,
                avg_retrieval_score=avg_score
            )
        else:
            response = self._handle_external_search_rag(
                user_query, chunks, history_context, paper_mapping, expanded_query
            )
        
        # Update history
        self.chat_history.add_message("user", user_query)
        self.chat_history.add_message("assistant", response.answer)
        
        return response

    
    def _query_pdf_mode(self, user_query: str) -> ChatbotResponse:
        """Handle query in PDF mode"""
        history_context = self.chat_history.get_recent_context(num_messages=4)
        
        # Generate answer from PDF
        answer, _ = self.gemini_agent.answer_from_paper(
            self.pdf_text, user_query, history_context
        )
        
        # Assess sufficiency
        assessment = self.gemini_agent.assess_information_sufficiency(
            user_query, self.pdf_text, answer
        )
        
        if assessment.get("is_sufficient", True):
            response = ChatbotResponse(
                answer=answer,
                sources=["Uploaded Research Paper"],
                method="pdf_only",
                mode="pdf"
            )
        else:
            response = self._handle_external_search_pdf(user_query, answer, history_context)
        
        # Update history
        self.chat_history.add_message("user", user_query)
        self.chat_history.add_message("assistant", response.answer)
        
        return response
    
    def _handle_external_search_rag(self, query: str, chunks: List[RetrievedChunk],
                                history_context: str, paper_mapping: Dict[str, int],
                                expanded_query: str) -> ChatbotResponse:
        """Handle external search for RAG mode"""
        # Use expanded query for external search
        search_query = self.gemini_agent.optimize_search_query(expanded_query, history_context)
        external_sources = self.serp_searcher.search_google_scholar(search_query, num_results=3)
        
        if not external_sources:
            return ChatbotResponse(
                answer="Limited information available in database.",
                sources=self._format_rag_sources_deduplicated(chunks, paper_mapping),
                method="rag_only_external_failed",
                mode="rag",
                retrieved_chunks=chunks
            )
        
        db_context = "\n\n".join([chunk.text for chunk in chunks])
        synthesized_answer = self.gemini_agent.synthesize_multi_source_answer(
            query, db_context, external_sources, history_context, "rag"
        )
        
        all_sources = self._format_rag_sources_deduplicated(chunks, paper_mapping) + [src.link for src in external_sources]
        
        return ChatbotResponse(
            answer=synthesized_answer,
            sources=all_sources,
            method="rag_plus_external",
            mode="rag",
            retrieved_chunks=chunks,
            external_sources=external_sources
        )

    
    def _handle_external_search_pdf(self, query: str, paper_answer: str,
                                    history_context: str) -> ChatbotResponse:
        """Handle external search for PDF mode"""
        # Extract reference numbers
        ref_numbers = re.findall(r"\[(\d+)\]", query)
        
        external_sources = []
        
        # Try reference lookup first
        if ref_numbers and self.pdf_references:
            external_sources = self.serp_searcher.lookup_references(
                self.pdf_references, ref_numbers, query
            )
        
        # If no references or lookup failed, do general search
        if not external_sources:
            search_query = self.gemini_agent.optimize_search_query(query, history_context)
            external_sources = self.serp_searcher.search_google_scholar(search_query, num_results=3)
        
        if not external_sources:
            return ChatbotResponse(
                answer=paper_answer + "\n\nNote: Could not retrieve additional sources.",
                sources=["Uploaded Research Paper"],
                method="pdf_only_external_failed",
                mode="pdf"
            )
        
        synthesized_answer = self.gemini_agent.synthesize_multi_source_answer(
            query, paper_answer, external_sources, history_context, "pdf"
        )
        
        all_sources = ["Uploaded Research Paper"] + [src.link for src in external_sources]
        
        return ChatbotResponse(
            answer=synthesized_answer,
            sources=all_sources,
            method="pdf_plus_external",
            mode="pdf",
            external_sources=external_sources,
            references_used=ref_numbers
        )
    
    def _handle_no_retrieval(self, query: str) -> ChatbotResponse:
        """Handle when no chunks retrieved"""
        history_context = self.chat_history.get_recent_context()
        search_query = self.gemini_agent.optimize_search_query(query, history_context)
        external_sources = self.serp_searcher.search_google_scholar(search_query, num_results=3)
        
        if not external_sources:
            return ChatbotResponse(
                answer="No relevant information found.",
                sources=[],
                method="no_results",
                mode="rag"
            )
        
        synthesized_answer = self.gemini_agent.synthesize_multi_source_answer(
            query, "", external_sources, history_context, "rag"
        )
        
        return ChatbotResponse(
            answer=synthesized_answer,
            sources=[src.link for src in external_sources],
            method="external_only",
            mode="rag",
            external_sources=external_sources
        )
    
    def _format_rag_sources(self, chunks: List[RetrievedChunk]) -> List[str]:
        """Format RAG chunk sources"""
        sources = []
        for chunk in chunks:
            paper_title = chunk.metadata.get("title", "Unknown Paper")
            authors = chunk.metadata.get("authors", [])
            year = chunk.metadata.get("year", "")
            
            authors_str = ", ".join(authors[:3]) if authors else "Unknown Authors"
            source_str = f"{paper_title} by {authors_str}"
            if year:
                source_str += f" ({year})"
            
            sources.append(source_str)
        return sources
    def _format_rag_sources_deduplicated(self, chunks: List[RetrievedChunk], 
                                     paper_mapping: Dict[str, int]) -> List[str]:
        """Format RAG sources with deduplication - one entry per paper"""
        paper_info = {}
        
        # Collect unique papers
        for chunk in chunks:
            paper_title = chunk.metadata.get("title", "Unknown Paper")
            if paper_title not in paper_info:
                authors = chunk.metadata.get("authors", [])
                year = chunk.metadata.get("year", "")
                
                authors_str = ", ".join(authors[:3]) if authors else "Unknown Authors"
                source_str = f"{paper_title} by {authors_str}"
                if year:
                    source_str += f" ({year})"
                
                paper_id = paper_mapping.get(paper_title, 0)
                paper_info[paper_title] = (paper_id, source_str)
        
        # Sort by paper ID and return formatted strings
        sorted_papers = sorted(paper_info.values(), key=lambda x: x[0])
        return [source_str for _, source_str in sorted_papers]

    def print_response(self, response: ChatbotResponse):
        """Pretty print response"""
        print("\n" + "="*80)
        print(f"MODE: {response.mode.upper()}")
        print("="*80)
        print("ANSWER:")
        print("-"*80)
        print(response.answer)
        print("\n" + "-"*80)
        print(f"METHOD: {response.method}")
        if response.avg_retrieval_score > 0:
            print(f"AVG RETRIEVAL SCORE: {response.avg_retrieval_score:.3f}")
        print(f"\nSOURCES ({len(response.sources)}):")
        for i, source in enumerate(response.sources, 1):
            print(f"  [{i}] {source}")
        print("="*80 + "\n")
    
    def clear_history(self):
        """Clear chat history"""
        self.chat_history.clear()


# ==================== Main Interactive Loop ====================
def main():
    """Main interactive chat"""
    
    print("="*80)
    print("UNIFIED RESEARCH CHATBOT")
    print("Automatically switches between RAG Database and PDF Analysis modes")
    print("="*80)
    print("\nCommands:")
    print("  'upload <path>' - Upload PDF and switch to PDF mode")
    print("  'rag' - Switch back to RAG database mode")
    print("  'clear' - Clear chat history")
    print("  'exit' - Quit")
    print("="*80 + "\n")
    
    chatbot = UnifiedResearchChatbot()
    
    while True:
        user_input = input(f"\n You ({chatbot.current_mode.upper()} mode): ").strip()
        
        if not user_input:
            continue
        
        if user_input.lower() == 'exit':
            print("Goodbye!")
            break
        
        if user_input.lower() == 'clear':
            chatbot.clear_history()
            print("Chat history cleared")
            continue
        
        if user_input.lower() == 'rag':
            chatbot.reset_to_rag_mode()
            print("Switched to RAG database mode")
            continue
        
        if user_input.lower().startswith('upload '):
            pdf_path = user_input[7:].strip()
            if chatbot.upload_pdf(pdf_path):
                print(f"PDF uploaded successfully. Now in PDF mode.")
            else:
                print(" Failed to upload PDF")
            continue
        
        try:
            response = chatbot.query(user_input)
            print(f"\n Assistant ({response.mode.upper()} mode):")
            chatbot.print_response(response)
        except Exception as e:
            logger.error(f"Error: {e}")
            print(f" Error: {e}")


if __name__ == "__main__":
    main()
