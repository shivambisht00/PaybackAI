# PayBack AI — Intelligent Revenue Recovery Agent

> **Turn failed payments into recovered revenue.**

PayBack AI is an intelligent revenue recovery platform designed for SaaS businesses, fintech platforms, and subscription services. It automatically analyzes failed payment transactions, calculates a transparent recovery score, generates personalized AI recovery messages via Gemini, issues secure 1-click retry links, and processes payment recoveries.

---

## 🏗️ Architecture Overview

```text
                  ┌────────────────────────────────────────┐
                  │   Client Applications & Portals        │
                  │  (Dashboard / Retry Page / Admin)     │
                  └──────────────────┬─────────────────────┘
                                     │ HTTP / REST API
                                     ▼
                  ┌────────────────────────────────────────┐
                  │        Express API Server              │
                  │   (routes/transactions, recovery,     │
                  │    retry, admin, webhook)              │
                  └──────────────────┬─────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│ Recovery Engine  │       │ Gemini AI Agent  │       │ Notifier & RZP   │
│ (classifier.js)  │       │  (aiAgent.js)    │       │ (notifier/rzp)   │
└────────┬─────────┘       └────────┬─────────┘       └────────┬─────────┘
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    │
                                    ▼
                       ┌──────────────────────────┐
                       │  SQLite Database Core    │
                       │ (./data/transactions.db) │
                       └──────────────────────────┘
```

---

## ⚡ Key Features

- **Transparent Rule-Based Scoring Engine:** Calculates a 0–100 recovery score based on amount, failure reason, and transaction recency.
- **Explainable Scoring Breakdown:** Every score provides a detailed mathematical breakdown showing factors, weights, points, and dynamic contextual explanations.
- **Gemini AI Personalized Recovery Messages:** Generates channel-tailored recovery copy (SMS, WhatsApp, Email) using Google's Gemini API with pre-formatted fallback protection.
- **Strict 1-Click Link Security & Invalidation:** Every retry token is cryptographically generated. Issuing a new link automatically invalidates any previous active link for that transaction.
- **Interactive Retry & Payment Recovery Portal:** Customers complete payment via a dedicated mobile-friendly checkout portal with live countdown timers.
- **Admin Management Portal:** Password-protected admin dashboard allowing full recovery attempt auditing, link resending, and forced link expiration.
- **Razorpay Test Mode & Demo Fallback:** Supports Razorpay Test Mode payment links with seamless fallback to internal demo checkout when credentials are absent.

---

## 🛠️ Technology Stack

- **Backend:** Node.js, Express.js (CommonJS)
- **Database:** SQLite via `better-sqlite3` (`./data/transactions.db`)
- **AI Engine:** Google Gemini API (`@google/generative-ai`)
- **Payment Gateway:** Razorpay Node.js SDK (Test Mode)
- **Notifications:** Nodemailer (SMTP with Console Mock fallback)
- **Frontend:** Plain HTML5, Modern CSS3, Vanilla JavaScript

---

## 🚀 Quick Start Guide

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/payback-ai.git
cd payback-ai
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and adjust settings as needed:
```bash
cp .env.example .env
```

`.env` configuration sample:
```env
PORT=3000
LINK_EXPIRY_MINUTES=30
ADMIN_PASSWORD=admin123

# Gemini API Key (Optional - uses fallback copy if empty)
GEMINI_API_KEY=your_gemini_api_key_here

# SMTP Email Configuration (Optional - uses console mock if empty)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=PayBack AI <noreply@payback.ai>

# Razorpay Test Mode (Optional - uses internal retry flow if empty)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

### 3. Seed Database
Generate 250 realistic failed transactions across Indian customer profiles:
```bash
npm run seed
```

### 4. Run Server
Start the development server:
```bash
npm run dev
# or
npm start
```

Access the application in your browser:
- **Main Dashboard:** `http://localhost:3000`
- **Admin Portal:** `http://localhost:3000/admin.html` (Password: `admin123`)

---

## 📊 End-to-End Recovery Flow

```text
Failed Payment Transaction in DB
       ↓
Click "Analyze" on Main Dashboard
       ↓
Scoring Engine calculates Score & Explainable Breakdown
       ↓
Gemini AI generates channel-specific Recovery Message
       ↓
Secure 1-Click Retry Token & Expiry (30 mins) issued
(Any previous active link for this transaction becomes INVALIDATED)
       ↓
Notification sent via Nodemailer / Console Log
       ↓
Customer opens Retry Link (http://localhost:3000/retry.html?token=...)
       ↓
Customer clicks "Pay Now"
       ↓
Payment succeeds → Transaction status updated to RECOVERED
       ↓
Retry Link status becomes USED (preventing re-use)
```

---

## 🔮 Future Scope

- **Multi-Touch Recovery Sequences:** Automated multi-stage drip reminders (Day 1 SMS, Day 3 WhatsApp, Day 7 Call).
- **Regional Language Localization:** Gemini AI generation in Hindi, Tamil, Telugu, and Kannada.
- **Machine Learning Calibration:** Continuous weighting updates based on historical recovery outcomes.

---

## 📄 License
MIT License. Built for educational and commercial revenue optimization.
