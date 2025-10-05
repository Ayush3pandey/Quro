# Quro — NASA Bioscience Research Platform

Quro is an AI-powered NASA Bioscience Research Platform that combines advanced research intelligence, semantic search, and interactive knowledge visualization — enabling scientists to explore, analyze, and connect complex research data effortlessly.

---

## Project Overview

Quro integrates multiple AI-driven components to deliver a complete end-to-end research experience.

### AI-powered Research Assistant (QuroBot)
- Dual modes: RAG database (semantic search across 500+ publications) and PDF analysis (upload and query research papers)
- Powered by Google Gemini, Qdrant, and Sentence Transformers

### Interactive Knowledge Graph
- Built using Neo4j Aura
- Visualizes research themes and relationships interactively

### Comprehensive Publication Database
- Over 500+ NASA Bioscience research papers
- Advanced filtering, MeSH term categorization, and semantic search

### Modern React Frontend
- Sleek and intuitive research dashboard
- Built with React 18, Tailwind CSS, React Router, and React Flow

---

## Folder Structure
```
QURO/
│
├── backend/
│ ├── data/
│ ├── logs/
│ ├── pdfs/
│ ├── schemas/
│ ├── uploads/
│ ├── venv/
│ ├── .env
│ ├── main.py
│ ├── QuroBot.py
│ ├── graph_api.py
│ ├── ingestion.py
│ ├── models.py
│ ├── qurobot_api.py
│ ├── publications.json
│ ├── requirements.txt
│ └── ...
│
└── nasa-bioscience-frontend/
├── public/
│ ├── images/
│ ├── videos/
│ └── index.html
│
├── src/
│ ├── components/
│ ├── context/
│ ├── hooks/
│ ├── pages/
│ ├── services/
│ └── utils/
│
├── package.json
├── tailwind.config.js
└── postcss.config.js
```
---

## Data Pipeline

1. Automated ingestion from PubMed Central (PMC)
2. PDF downloads and content extraction
3. MeSH term tagging and categorization
4. Sentence-transformer embeddings stored in Qdrant
5. Knowledge graph construction in Neo4j

---

## Prerequisites

Before starting, ensure you have the following installed:

| Tool | Version | Purpose |
|------|----------|----------|
| Python | 3.8+ | Backend API |
| Node.js / npm | v24.1.0 / 11.3.0 | Frontend |
| Neo4j Aura | — | Knowledge Graph |
| Qdrant Cloud | — | Vector Database |
| Google Gemini API | — | LLM for chatbot |
| SERP API | — | External web search integration |

---

## Required API Keys

| Service | Purpose | Link |
|----------|----------|------|
| Google Gemini | LLM for QuroBot | [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey) |
| Neo4j Aura | Knowledge Graph visualization | [https://console.neo4j.io/](https://console.neo4j.io/) |
| Qdrant Cloud | Vector database for semantic search | [https://cloud.qdrant.io/](https://cloud.qdrant.io/) |
| SERP API | External web search integration | [https://serpapi.com/](https://serpapi.com/) |

---

## Environment Configuration

Create a `.env` file inside the `backend/` directory and include the following variables:

  ```bash
  # API Keys
  GEMINI_API_KEY=your_gemini_api_key
  QDRANT_URL=your_qdrant_instance_url
  QDRANT_API_KEY=your_qdrant_api_key
  NEO4J_URI=your_neo4j_uri
  NEO4J_USER=your_neo4j_username
  NEO4J_PASSWORD=your_neo4j_password
  SERP_API_KEY=your_serp_api_key
  
  # PubMed API Configuration
  PUBMED_EMAIL=your@gmail.com
  RATE_LIMIT_DELAY=1.0
  PDF_DOWNLOAD_DELAY=2.0
  MAX_RETRIES=3
  MAX_CONCURRENT_DOWNLOADS=5
  
  # Data Configuration
  CSV_FILE_PATH=data/SB_publication_PMC.csv
  JSON_OUTPUT_PATH=publications.json
  PDF_DOWNLOAD_PATH=pdfs
  SCHEMA_PATH=schemas

```
## Backend Setup

```bash
cd backend
python -m venv venv

# Activate virtual environment
source venv/bin/activate     # macOS/Linux
venv\Scripts\activate        # Windows

# Install dependencies
pip install -r requirements.txt

# Run the backend
uvicorn main:app --reload
Backend runs on: http://localhost:8000
```


## Frontend Setup
```bash
cd nasa-bioscience-frontend
npm install
npm start
Frontend runs on: http://localhost:3000
```


## Troubleshooting

| Issue                  | Possible Fix                                   |
| ---------------------- | ---------------------------------------------- |
| Backend not starting   | Check Python version and dependencies          |
| API keys not found     | Verify `.env` file location inside `/backend`  |
| Neo4j connection error | Confirm Aura connection string and credentials |
| Qdrant vector error    | Ensure Qdrant Cloud instance is active         |
| PDF not processing     | Check file permissions and backend logs        |
