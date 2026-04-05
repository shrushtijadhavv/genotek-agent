// ─── Candidate ────────────────────────────────────────────────────────────────

export interface Candidate {
  id: string
  name: string
  email: string
  phone?: string
  resume_text: string
  years_experience: number
  skills: string[]
  education?: string
  source: 'internshala' | 'manual' | 'api'
  applied_at: string
  status: CandidateStatus
  score?: number
  rank?: number
  created_at: string
  updated_at: string
}

export type CandidateStatus =
  | 'pending'
  | 'scored'
  | 'interview_scheduled'
  | 'interviewing'
  | 'interview_complete'
  | 'shortlisted'
  | 'rejected'
  | 'hired'

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface ScoringRubric {
  skills_match: number       // 0–100
  experience: number         // 0–100
  communication: number      // 0–100
  problem_solving: number    // 0–100
  culture_fit: number        // 0–100
  red_flags: number          // 0–100 (higher = more red flags)
  composite: number          // weighted final score
}

export interface ScoringResult {
  id: string
  candidate_id: string
  rubric: ScoringRubric
  reasoning: string
  ai_detected: boolean
  scored_at: string
  model_version: string
}

// ─── Interview ────────────────────────────────────────────────────────────────

export interface InterviewSession {
  id: string
  candidate_id: string
  round: number
  status: 'pending' | 'active' | 'complete' | 'abandoned'
  messages: InterviewMessage[]
  evaluation?: InterviewEvaluation
  started_at?: string
  completed_at?: string
  created_at: string
}

export interface InterviewMessage {
  id: string
  session_id: string
  role: 'assistant' | 'candidate'
  content: string
  timestamp: string
  ai_detection?: AIDetectionResult
}

export interface InterviewEvaluation {
  technical_depth: number
  communication_clarity: number
  problem_approach: number
  red_flags: string[]
  overall_score: number
  recommendation: 'advance' | 'reject' | 'hold'
  summary: string
}

// ─── AI Detection ─────────────────────────────────────────────────────────────

export interface AIDetectionResult {
  verdict: 'human' | 'ai_generated' | 'mixed'
  confidence: number           // 0–1
  flags: AIDetectionFlag[]
  perplexity_score: number     // lower = more AI-like
  avg_sentence_length: number
  reasoning: string
}

export interface AIDetectionFlag {
  pattern: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

// ─── Outcome / Feedback loop ──────────────────────────────────────────────────

export interface HiringOutcome {
  id: string
  candidate_id: string
  session_id?: string
  decision: 'hired' | 'rejected' | 'no_show' | 'withdrew'
  decided_by: string
  notes?: string
  decided_at: string
}

export interface ModelWeights {
  id: string
  version: number
  weights: {
    skills_match: number
    experience: number
    communication: number
    problem_solving: number
    culture_fit: number
    red_flags: number
  }
  training_sample_size: number
  accuracy?: number
  created_at: string
}

// ─── API Request/Response types ───────────────────────────────────────────────

export interface IngestRequest {
  csv_content?: string
  candidates?: Partial<Candidate>[]
}

export interface IngestResponse {
  imported: number
  skipped: number
  errors: string[]
  candidate_ids: string[]
}

export interface ScoreRequest {
  candidate_id: string
  force_rescore?: boolean
}

export interface ScoreResponse {
  success: boolean
  result?: ScoringResult
  error?: string
}

export interface InterviewStartRequest {
  candidate_id: string
  round?: number
}

export interface InterviewMessageRequest {
  session_id: string
  message: string
}

export interface DetectAIRequest {
  text: string
  context?: string
}