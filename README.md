# GenoTek Autonomous Hiring Agent

A full-stack AI hiring pipeline built with Next.js, Claude API, and Supabase.

## Features

- **Applicant ingestion** — CSV upload from Internshala or manual/API entry
- **Autonomous scoring** — Claude evaluates each resume against a weighted rubric (skills, experience, communication, problem-solving, culture fit, red flags)
- **Multi-round interviews** — Autonomous Claude-powered chat that adapts follow-up questions based on answers
- **AI detection** — Heuristic + Claude-powered analysis flags AI-generated responses with confidence score
- **Feedback loop** — Records hiring outcomes and recalibrates scoring weights over time using real hire/reject data
- **Supabase memory** — Full persistence: candidates, sessions, transcripts, detection logs, model weights

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo>
cd genotek-agent
npm install
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) → New project
2. Open the SQL editor
3. Copy and run the entire contents of `supabase/schema.sql`
4. Copy your project URL and keys from Settings → API

### 3. Configure environment

```bash
cp .env.local .env.local
```

Edit `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deployment

### GitHub

1. Create a new repository on [GitHub](https://github.com/new)
2. Add the remote and push:
   ```bash
   git remote add origin https://github.com/your-username/your-repo.git
   git push -u origin main
   ```

### Vercel

1. Go to [Vercel](https://vercel.com) and sign in with GitHub
2. Click "Import Project" and select your GitHub repository
3. Configure environment variables in Vercel dashboard:
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy!

---

## Architecture

```
genotek-agent/
├── app/
│   ├── page.tsx                  # Dashboard — candidate list + stats
│   ├── interview/page.tsx        # Live interview room
│   ├── ingest/page.tsx           # CSV upload + manual entry
│   └── api/
│       ├── ingest/route.ts       # POST: import candidates
│       ├── score/route.ts        # POST: score one or batch | GET: rankings
│       ├── interview/route.ts    # POST: start/message | GET: session history
│       ├── detect/route.ts       # POST: AI detection on text
│       └── outcomes/route.ts     # POST: record hire/reject | GET: stats
├── lib/
│   ├── scorer.ts                 # Claude rubric scoring + batch ranking
│   ├── interviewer.ts            # Multi-turn interview engine
│   ├── aidetect.ts               # Heuristic + Claude AI detection
│   ├── feedback.ts               # Outcome logging + weight recalibration
│   ├── ingest.ts                 # CSV parsing + DB insert
│   ├── anthropic.ts              # Anthropic client
│   └── supabase.ts               # Supabase clients (admin + anon)
├── supabase/
│   └── schema.sql                # Full DB schema + RLS + views
└── types/
    └── index.ts                  # All TypeScript types
```

---

## API Reference

### Import candidates
```bash
# Upload CSV
curl -X POST /api/ingest \
  -H "Content-Type: application/json" \
  -d '{"csv_content": "Name,Email,Cover Letter\nPriya,p@x.com,I am..."}'

# Add manually
curl -X POST /api/ingest \
  -H "Content-Type: application/json" \
  -d '{"candidates": [{"name":"Priya","email":"p@x.com","resume_text":"...","skills":["React"]}]}'
```

### Score candidates
```bash
# Score one
curl -X POST /api/score \
  -d '{"candidate_id": "uuid-here"}'

# Batch score + rank all pending
curl -X POST /api/score \
  -d '{"batch": true, "limit": 100}'

# Get rankings
curl /api/score?limit=50
```

### Start an interview
```bash
# Start session
curl -X POST /api/interview \
  -d '{"action":"start","candidate_id":"uuid"}'

# Send message
curl -X POST /api/interview \
  -d '{"action":"message","session_id":"uuid","message":"I built a RAG pipeline..."}'
```

### AI detection
```bash
curl -X POST /api/detect \
  -d '{"text":"In today'\''s rapidly evolving landscape, I leverage my skills..."}'
```

### Record outcome (triggers learning)
```bash
curl -X POST /api/outcomes \
  -d '{"candidate_id":"uuid","decision":"hired","decided_by":"hr@genotek.global"}'
```

---

## How the feedback loop works

1. Every time you record an outcome (`hired` or `rejected`), it's saved to `hiring_outcomes`
2. Once 20+ outcomes are recorded, `recalibrateWeights()` runs automatically
3. It computes which scoring dimensions best discriminate hired vs rejected candidates
4. New weights are saved as a new version in `model_weights`
5. All future scoring uses the latest weights

---

## Deploying to production

### Vercel (recommended)
```bash
npm install -g vercel
vercel --prod
```
Add all env vars in Vercel dashboard → Settings → Environment Variables.

### Self-hosted
```bash
npm run build
npm run start
```

---

## Internshala CSV format

Internshala employer exports use these column names (adjust in `lib/ingest.ts` if yours differ):
- `Name`
- `Email`  
- `Phone`
- `Cover Letter`
- `Resume`
- `Skills`
- `Experience`
- `Education`