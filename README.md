# 🛡️ Sentinel Guard

**Sentinel Guard** is a full-stack Insider Threat & Data Access Monitoring platform. It ingests user access logs, applies rule-based and ML-powered anomaly detection (Isolation Forest), computes per-user behavioral baselines, and surfaces actionable security alerts through a modern React dashboard.

---

## 📁 Project Structure

```
sentinel-guard/
├── backend/                  # Python Flask API
│   ├── app.py                # Main Flask application & API routes
│   ├── database.py           # SQLite database setup & queries
│   ├── detection_engine.py   # Rule engine + Isolation Forest ML model
│   ├── import_dataset.py     # Sample data import logic
│   ├── report_generator.py   # PDF incident report generator (ReportLab)
│   ├── requirements.txt      # Python dependencies
│   └── sentinel_guard.db     # SQLite database (auto-created)
├── frontend/                 # React + Vite frontend
│   ├── src/
│   │   ├── views/
│   │   │   ├── Dashboard.jsx       # Main analytics dashboard
│   │   │   ├── Alerts.jsx          # Alert list & filtering
│   │   │   ├── Investigation.jsx   # Per-alert deep-dive view
│   │   │   └── Architecture.jsx    # System architecture diagram
│   │   └── components/             # Reusable UI components
│   ├── package.json
│   └── vite.config.js
└── sample_data/              # Sample CSV files for quick demo
    ├── data_access_logs.csv  # Sample access log events
    └── user_profiles.csv     # Sample user profiles
```

---

## ✅ Prerequisites

| Requirement | Version |
|---|---|
| **Python** | 3.9 or higher |
| **Node.js** | 18 or higher |
| **npm** | 8 or higher |

---

## 🚀 Running the Application

The application has two parts that must run simultaneously: the **Backend API** and the **Frontend Dev Server**.

### Step 1 — Set Up & Start the Backend

Open a terminal and run the following commands:

```powershell
# Navigate to the backend directory
cd e:\Project\sentinel-guard\backend

# Create a virtual environment (only needed once)
python -m venv venv

# Activate the virtual environment
.\venv\Scripts\Activate

# Install dependencies (only needed once)
pip install -r requirements.txt

# Start the Flask API server
python app.py
```

The backend will start at **http://localhost:5000**

> 💡 The SQLite database (`sentinel_guard.db`) is created automatically on first run. No separate database setup is needed.

---

### Step 2 — Set Up & Start the Frontend

Open a **second** terminal and run:

```powershell
# Navigate to the frontend directory
cd e:\Project\sentinel-guard\frontend

# Install Node dependencies (only needed once)
npm install

# Start the Vite development server
npm run dev
```

The frontend will start at **http://localhost:5173**

Open **http://localhost:5173** in your browser to use the application.

---

## 🗄️ Loading Sample Data

The application ships with sample data to get you started immediately.

**Option A — Via the UI (Recommended)**

1. Open the dashboard at **http://localhost:5173**
2. Click the **"Dataset Management"** button in the top-right corner
3. Click **"Import Sample Dataset"** — this loads all sample CSVs automatically

**Option B — Via the API directly**

```powershell
curl -X POST http://localhost:5000/api/import-dataset
```

---

## 📊 Features

| Feature | Description |
|---|---|
| **Dashboard** | Real-time risk trend charts, severity distribution, top risky users, department heatmap |
| **Alerts View** | Filterable alert list by severity, department, user, and date range |
| **Investigation** | Per-alert deep-dive with user profile, behavioral baseline, rules violated, and AI narrative |
| **PDF Reports** | Download per-incident PDF reports directly from the Investigation view |
| **Log Ingestion** | Upload custom CSV access logs via the Dataset Management modal |
| **Profile Ingestion** | Upload user profile CSVs to register known users and their baselines |
| **Refresh Analysis** | Re-run the full ML pipeline (retrain Isolation Forest + recompute all risk scores) |

---

## 📡 Backend API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ingest/logs` | Upload a CSV of access logs |
| `POST` | `/api/ingest/profiles` | Upload a CSV of user profiles |
| `POST` | `/api/import-dataset` | Import the built-in sample dataset |
| `POST` | `/api/refresh-analysis` | Recompute all baselines and risk scores |
| `GET` | `/api/dashboard/summary` | Get headline KPI counts |
| `GET` | `/api/dashboard/charts` | Get all chart data for the dashboard |
| `GET` | `/api/alerts` | List alerts (supports filtering via query params) |
| `GET` | `/api/alerts/:id` | Get full detail for a single alert |
| `POST` | `/api/alerts/:id/action` | Update alert status (escalate, investigate, close) |
| `GET` | `/api/alerts/:id/pdf` | Download PDF incident report |

---

## 📋 CSV Format Reference

### Access Logs (`data_access_logs.csv`)

| Column | Type | Example |
|---|---|---|
| `timestamp` | string | `2024-01-15 09:32:00` |
| `user_id` | string | `U001` |
| `username` | string | `john.doe` |
| `department` | string | `Finance` |
| `data_asset` | string | `customer_records` |
| `data_sensitivity` | string | `HIGH` |
| `query_type` | string | `SELECT` |
| `rowcount` | integer | `1500` |
| `access_method` | string | `direct_db` |
| `destination` | string | `internal` |

### User Profiles (`user_profiles.csv`)

| Column | Type | Example |
|---|---|---|
| `user_id` | string | `U001` |
| `username` | string | `john.doe` |
| `department` | string | `Finance` |
| `role` | string | `Analyst` |
| `tenure_months` | integer | `24` |
| `approved_data_assets` | JSON array | `["customer_records","sales_data"]` |
| `typical_access_hours` | JSON array | `[9,10,11,14,15,16]` |
| `avg_queries_per_day` | float | `12.5` |
| `avg_rowcount_per_query` | float | `200.0` |

---

## 🔧 Tech Stack

**Backend**
- [Flask](https://flask.palletsprojects.com/) — Python web framework
- [Flask-CORS](https://flask-cors.readthedocs.io/) — Cross-origin resource sharing
- [pandas](https://pandas.pydata.org/) — Data manipulation
- [scikit-learn](https://scikit-learn.org/) — Isolation Forest anomaly detection
- [ReportLab](https://www.reportlab.com/) — PDF report generation
- SQLite — Embedded database (no setup required)

**Frontend**
- [React 19](https://react.dev/) — UI framework
- [Vite](https://vite.dev/) — Build tool & dev server
- [Tailwind CSS v4](https://tailwindcss.com/) — Utility-first CSS
- [Recharts](https://recharts.org/) — Chart library
- [Lucide React](https://lucide.dev/) — Icon library

---

## 🛠️ Troubleshooting

**`ModuleNotFoundError` when starting the backend**
> Make sure your virtual environment is activated: `.\venv\Scripts\Activate`

**Backend starts but frontend shows no data**
> Confirm the Flask server is running on port 5000 and CORS is not being blocked. Check the browser console for network errors.

**`npm install` fails**
> Ensure you are using Node.js 18+. Run `node -v` to check.

**Database appears empty on startup**
> Use the **"Import Sample Dataset"** button in the UI or call `POST /api/import-dataset` to seed the database.
