# National Material Master (NMM) — Prototype

Internal reference & overview document for the National Material Identity Harmonization Platform prototype.

---

## 🌐 Live Prototype Links & Access

| Component | Provider / Platform | Live URL |
| :--- | :--- | :--- |
| **Frontend Web UI** | Render Web Service | [https://sih-26099-frontend.onrender.com](https://sih-26099-frontend.onrender.com) |
| **Backend REST API** | Render Web Service | [https://sih-26099-prototype.onrender.com](https://sih-26099-prototype.onrender.com) |
| **API Health Check** | Render Endpoint | [https://sih-26099-prototype.onrender.com/api/health](https://sih-26099-prototype.onrender.com/api/health) |
| **AI Matching Engine** | Render Web Service | [https://sih-ai-service-dtsv.onrender.com](https://sih-ai-service-dtsv.onrender.com) |
| **Database** | Render PostgreSQL | `nmm_db` (Oregon region) |

### Test Accounts
- **Admin**: `admin` / `admin123` (Full system access, approvals, configurations)
- **Data Steward**: `steward` / `steward123` (Review queue, mapping approvals, data curation)

---

## 🎯 What Problem This Solves

Different Central Public Sector Enterprises (CPSEs) like ONGC, BHEL, NTPC, and IOCL purchase identical physical items using completely different internal part numbers and descriptions.

- **Example**:
  - CPSE A: `"BALL BEARING 6205-2RS SKF DEEP GROOVE"` (Code: `ONGC-BB-001`)
  - CPSE B: `"BRG DEEP GROOVE BALL 25X52X15 6205 2RS"` (Code: `BHEL-982103`)
- **Result**: Duplicate purchases, zero cross-enterprise price visibility, fragmented inventory.
- **This Platform**: Ingests disparate catalogs, extracts physical properties ("Material DNA"), matches equivalents using AI, and generates a unified **National Material Code (NMC)**.

---

## 🏗️ Architecture: What is Used & How

```text
Browser
  │
  ├─► React + Vite SPA (Nginx container on Render)
  │     └─► Direct HTTPS REST calls with Bearer JWT
  │
  ▼
Spring Boot 3 Backend (Java 21, Render Docker)
  │
  ├─► PostgreSQL (Render managed DB) — Relational catalog, mappings, audit events
  │
  └─► Python AI Service (FastAPI, Render Docker) — Material DNA extraction & token matching
```

### 1. Frontend (`frontend/`)
- **Stack**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React, React Router DOM.
- **Hosting**: Packaged into a lightweight Alpine Nginx container.
- **How it talks**: Makes authenticated API requests directly to the Spring Boot backend (`https://sih-26099-prototype.onrender.com/api`) storing the JWT token in `localStorage`. Nginx is configured with SPA fallback (`try_files`) and an optional reverse proxy for local dev.

### 2. Backend API (`backend/`)
- **Stack**: Java 21, Spring Boot 3, Spring Data JPA, Hibernate, Spring Security.
- **Security**: Stateless JWT authentication with pre-configured permissive CORS allowing the Render frontend origin.
- **How it works**: Manages material lifecycle, CPSE repository records, mapping linkages, approval workflows, and audit events. Delegates NLP/matching requests to the AI service.

### 3. AI Service (`ai-service/`)
- **Stack**: Python 3.11, FastAPI, Uvicorn, RegEx & Token Normalization algorithms.
- **How it works**:
  - `analyzer.py`: Parses unstructured item descriptions to extract **Material DNA** (dimensions, material grade, pressure ratings, standards like IS/ASTM/DIN, thread types).
  - `matcher.py`: Compares material descriptions and DNA structures, returning match confidence scores (Exact, High, Review Required).

### 4. Database
- **Engine**: PostgreSQL 16 on Render.
- **Tables**: `common_material` (NMM master records), `source_material` (CPSE catalog items), `material_mapping` (links between CPSE items and NMM), `match_recommendation` (AI candidate matches), `audit_event`, and `app_user`.

---

## ⚙️ Core Application Functions

### 1. Dashboard (`/`)
- High-level executive view: Total materials imported, normalized master items, approved mappings, and pending review counts.
- Summary cards on cross-CPSE harmonization status and system health.

### 2. CPSE Repositories (`/cpse-repositories`)
- Shows connected enterprise repositories (ONGC, BHEL, NTPC, Coal India, etc.).
- Displays catalog size, mapping coverage %, and connection status.

### 3. Material Master (`/master`)
- Searchable canonical catalog of National Materials.
- Shows standard descriptions, assigned National Material Code (NMC), category taxonomy, and linked CPSE source materials.

### 4. AI Matching Engine (`/matching`)
- Triggers batch matching jobs across unmapped CPSE materials.
- Visualizes match distribution: Exact (Automated), Probable (Needs Review), and New Material creation candidates.

### 5. Review Queue (`/review-queue`)
- **Human-in-the-Loop workflow**: Displays AI match recommendations that fall within the threshold requiring human review.
- Stewards compare source CPSE material vs. proposed National Master item side-by-side with confidence scores.
- Actions: **Approve Mapping**, **Reject Match**, or **Escalate for Engineering Review**.

### 6. CPSE Mappings (`/cpse-mappings`)
- Complete mapping matrix linking legacy CPSE internal item codes to their designated National Material Code (NMC).
- Allows filtering by enterprise, status, and verification date.

### 7. Procurement Intelligence (`/procurement`)
- Detects cross-CPSE procurement synergies:
  - Price variance across enterprises buying the same physical item.
  - Joint procurement recommendations for bulk price discounts.
  - Identification of vendor overlap.

### 8. Data Quality Engine (`/data-quality`)
- Audits CPSE catalogs for dirty data:
  - Missing mandatory specifications (dimensions, material grade, rating).
  - Ambiguous abbreviations and unit measurement inconsistencies.
  - Assigns severity levels (`CRITICAL`, `WARNING`, `INFO`).

### 9. Migration & Ingestion (`/migration`)
- Upload CPSE inventory CSV/Excel dumps.
- Tracks ingestion jobs, batch parsing status, and failure reports.

### 10. Audit Trail (`/audit`)
- Immutable log recording all critical events: who approved a match, mapping overrides, role updates, and job executions with timestamps.

---

## 🚀 Local Run (Optional)

To spin up the entire multi-container stack locally:

```bash
# 1. Start all services via Docker Compose
docker-compose up --build

# 2. Ports opened:
# Frontend UI:   http://localhost:5173
# Spring Boot:   http://localhost:8080
# AI Service:    http://localhost:8000
# PostgreSQL:    localhost:5432
```
