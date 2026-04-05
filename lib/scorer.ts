import { groq, MODEL } from './anthropic'
import { supabaseAdmin } from './supabase'
import type { Candidate, ScoringResult, ScoringRubric } from '@/types'

async function getWeights() {
  const { data } = await supabaseAdmin
    .from('model_weights')
    .select('*')
    .order('version', { ascending: false })
    .limit(1)
    .single()

  return data ?? {
    w_skills: 0.25,
    w_experience: 0.20,
    w_communication: 0.20,
    w_problem: 0.20,
    w_culture: 0.10,
    w_red_flags: 0.05,
  }
}

function buildScoringPrompt(candidate: Candidate): string {
  return `You are a senior technical recruiter at GenoTek, an AI biotech company.

Evaluate this candidate for an AI Agent Developer role. Score each dimension 0-100.

## Role Requirements
- Build autonomous AI agents using LLMs
- Strong TypeScript/Python, REST APIs, database design
- Experience with Supabase, vector databases, or similar
- Ability to design multi-step agentic pipelines

## Candidate Profile
Name: ${candidate.name}
Experience: ${candidate.years_experience} years
Skills: ${candidate.skills.join(', ')}
Education: ${candidate.education ?? 'Not specified'}

## Resume
${candidate.resume_text.slice(0, 2000)}

Respond with ONLY this JSON (no markdown, no extra text):
{"skills_match":75,"experience":70,"communication":80,"problem_solving":65,"culture_fit":72,"red_flags":10,"reasoning":"2-3 sentence justification here"}`
}

function computeComposite(rubric: Omit<ScoringRubric, 'composite'>, weights: any): number {
  const raw =
    rubric.skills_match    * weights.w_skills        +
    rubric.experience      * weights.w_experience    +
    rubric.communication   * weights.w_communication +
    rubric.problem_solving * weights.w_problem       +
    rubric.culture_fit     * weights.w_culture       -
    rubric.red_flags       * weights.w_red_flags

  return Math.max(0, Math.min(100, Math.round(raw * 10) / 10))
}

export async function scoreCandidate(candidate: Candidate): Promise<ScoringResult> {
  const weights = await getWeights()

  const completion = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 512,
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: 'You are a JSON-only scoring engine. Respond with valid JSON only. No markdown fences. No text outside the JSON object.',
      },
      {
        role: 'user',
        content: buildScoringPrompt(candidate),
      },
    ],
  })

  const text = completion.choices[0]?.message?.content ?? ''
  const clean = text.replace(/```json|```/g, '').trim()

  let parsed: any
  try {
    parsed = JSON.parse(clean)
  } catch {
    const match = clean.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`Invalid JSON from model: ${clean.slice(0, 200)}`)
    parsed = JSON.parse(match[0])
  }

  const rubric: Omit<ScoringRubric, 'composite'> = {
    skills_match:    Math.round(parsed.skills_match    ?? 50),
    experience:      Math.round(parsed.experience      ?? 50),
    communication:   Math.round(parsed.communication   ?? 50),
    problem_solving: Math.round(parsed.problem_solving ?? 50),
    culture_fit:     Math.round(parsed.culture_fit     ?? 50),
    red_flags:       Math.round(parsed.red_flags       ?? 10),
  }

  const composite = computeComposite(rubric, weights)

  const { data: saved, error } = await supabaseAdmin
    .from('scoring_results')
    .insert({
      candidate_id:  candidate.id,
      ...rubric,
      composite,
      reasoning:     parsed.reasoning ?? '',
      ai_detected:   false,
      model_version: 'groq-v1',
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to save score: ${error.message}`)

  await supabaseAdmin
    .from('candidates')
    .update({ score: composite, status: 'scored' })
    .eq('id', candidate.id)

  return {
    id:            saved.id,
    candidate_id:  candidate.id,
    rubric:        { ...rubric, composite },
    reasoning:     parsed.reasoning ?? '',
    ai_detected:   false,
    scored_at:     saved.scored_at,
    model_version: 'groq-v1',
  }
}

export async function batchScoreAndRank(limit = 100): Promise<{ processed: number; errors: number }> {
  const { data: pending } = await supabaseAdmin
    .from('candidates')
    .select('*')
    .eq('status', 'pending')
    .limit(limit)

  if (!pending?.length) return { processed: 0, errors: 0 }

  let processed = 0
  let errors = 0

  // Sequential with delay — Groq free tier has rate limits
  for (const candidate of pending) {
    try {
      await scoreCandidate(candidate as Candidate)
      processed++
      await new Promise(r => setTimeout(r, 600))
    } catch (e) {
      console.error('[score error]', (e as PromiseRejectedResult).reason ?? e)
      errors++
    }
  }

  await reRankAll()
  return { processed, errors }
}

export async function reRankAll(): Promise<void> {
  const { data: scored } = await supabaseAdmin
    .from('candidates')
    .select('id, score')
    .not('score', 'is', null)
    .order('score', { ascending: false })

  if (!scored) return

  for (let idx = 0; idx < scored.length; idx++) {
    await supabaseAdmin
      .from('candidates')
      .update({ rank: idx + 1 })
      .eq('id', scored[idx].id)
  }
}