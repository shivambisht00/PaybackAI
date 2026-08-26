# paybackAI — Design Package & Blueprint

## 1. Brand Premise & Positioning
- **Brand Name:** paybackAI
- **Tagline:** Smart Payment Recovery Agent
- **Target Audience:** SaaS founders, finance teams, subscription business owners losing revenue to failed cards and soft declines.
- **Single Call to Action:** "Start Recovering Revenue"
- **Primary Value Prop:** Recover 70%+ of failed subscription payments on autopilot with silent AI retries and zero-friction customer magic links.

---

## 2. Visual System
- **Background Canvas:** Deep Midnight Obsidian (`#0A0B10`)
- **Primary Accent:** Luminous Cyan (`#00F0FF`)
- **Secondary Accent:** Sovereign Warm Gold (`#FFB800`)
- **Surface Cards:** Dark Slate (`#141620`) with 1px hairline cyan borders (`rgba(0, 240, 255, 0.15)`)
- **Text Primary:** Pure Chalk (`#F4F6FB`)
- **Text Muted:** Muted Steel (`#8E95A5`)
- **Typography:**
  - Display: `Space Grotesk`, sans-serif (Bold 700, Medium 500)
  - Body: `Plus Jakarta Sans`, sans-serif (Regular 400, Medium 500)
  - Monospace: `JetBrains Mono`, monospace (For transaction IDs, recovery scores, timestamps)

---

## 3. Hero Beat Map & Caption Band Schedule (0.00 to 1.00 Progress)

### Band 1: Progress 0.00 – 0.22 (The Pain Hook)
- **Headline:** 20% of your churn is a lie.
- **Subline:** Failed credit cards and soft declines quietly steal 10% of your annual revenue.
- **Footage Beat:** Fractured neon cyan lines drifting in a dark abyss, representing lost payment streams.
- **Entrance Choreography:** Scatter-assemble with character stagger and one-time load ramp.

### Band 2: Progress 0.28 – 0.52 (The Intelligence Pivot)
- **Headline:** Silent AI retries intercept every decline.
- **Subline:** Smart algorithms analyze decline codes to re-attempt payments at the exact millisecond funds clear.
- **Footage Beat:** Golden node flares ignite at stream intersections, steering broken lines into aligned vectors.
- **Entrance Choreography:** Grid snap-align with horizontal stagger.

### Band 3: Progress 0.58 – 0.82 (The Zero-Friction Recovery)
- **Headline:** 1-click magic links. Zero login required.
- **Subline:** Empathetic, brand-matched email & SMS alerts let customers update payment details in seconds.
- **Footage Beat:** Luminous streams merge into a intense beam of pure cyan and gold light flowing forward.
- **Entrance Choreography:** Word-punch with dynamic overshoot on key terms.

### Band 4: Progress 0.88 – 1.00 (The Settle & Action)
- **Headline:** Recover your lost ARR on autopilot.
- **Subline:** Connect your Stripe account in 2 minutes. Pay only when we recover your cash.
- **Footage Beat:** The energy beam converges into a glowing crystalline prism resting perfectly in negative space.
- **Entrance Choreography:** Word-by-word rise into staged CTA reveal.

---

## 4. Below-the-Fold Website Structure

### Section 1: The Interactive Recovery Simulator (The 1 Interactive Moment)
- **Mechanic:** Press and hold "Simulate Payment Recovery" button.
- **Visual:** Live recovery score meter rises from 0% to 84.7%, real-time failed transaction logs resolve from red 'FAILED' status to glowing green 'RECOVERED' status with simulated recovery value ($4,290 ARR saved).

### Section 2: How It Works (3 Clear Steps)
1. **Step 1 — Connect Stripe:** 2-minute OAuth integration. Zero code required.
2. **Step 2 — AI Smart Retries:** Machine learning algorithms calculate optimal retry windows per issuing bank.
3. **Step 3 — Frictionless Magic Links:** Branded SMS & Email recovery notifications with 1-tap card updating.

### Section 3: Live Recovery Metrics & Social Proof
- Metric Cards: 84.7% Recovery Rate | $14.2M Recovered | < 24h Average Recovery Time.
- Testimonial highlights from SaaS founders with verified dollar figures.

### Section 4: Live SQLite Database & API Core (The Real Working Product)
- Express + SQLite backend endpoints:
  - `GET /api/transactions`: Retrieves failed & recovered payment records from `./data/transactions.db`.
  - `POST /api/recovery/attempt`: Simulates sending a smart recovery email & magic token link.
  - `GET /api/recovery/verify/:token`: Verifies and resolves payment status in SQLite.

### Section 5: Objection-Busting FAQ
- "Will this annoy my existing customers?" -> No. Silent retries recover 45% without sending a single notification.
- "How long does setup take?" -> Under 2 minutes via automated API webhooks.
- "What is your pricing?" -> 100% performance-based. We only take a small fee when payment is recovered.

### Section 6: Final Conversion Form
- Input field: Business Email + Monthly Failed Payment Volume.
- Button: "Start Recovering Revenue"
- Action: Direct API post to `/api/recovery/demo-request` with instant confirmation state.

---

## 5. Verification & Quality Floor
- Contrast checks: All text > 4.5:1 ratio over scrim layers.
- Responsive gates: Desktop scroll video stage | Phone clean static image stage.
- Performance: Streamed Blob loading ring, zero lag, frame-rate independent lerp loop.
