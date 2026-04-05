import { groq, MODEL } from './anthropic'
import { supabaseAdmin } from './supabase'
import { detectAI } from './aidetect'
import type { Candidate, InterviewSession, InterviewMessage, InterviewEvaluation } from '@/types'

function buildSystemPrompt(candidate: Candidate, round: number): string {
  return `You are an autonomous hiring agent for GenoTek, an AI biotech company. You are conducting a ${round === 1 ? 'first' : 'second'} round technical interview.

Candidate: ${candidate.name}
Experience: ${candidate.years_experience} years
Skills: ${candidate.skills.join(', ')}
Resume score: ${candidate.score ?? 'Not yet scored'}

Your objectives:
1. Assess technical depth in AI/LLM development
2. Evaluate problem-solving through open-ended scenarios
3. Probe communication clarity and structured thinking
4. Ask adaptive follow-up questions based on answers
5. Complete the interview in 6-8 exchanges

Rules:
- Ask ONE question at a time
- If an answer is vague, ask a specific follow-up
- Be professional but conversational
- After 6-8 exchanges, wrap up and say you will send a summary

Do NOT reveal scores, ask personal questions, or discuss salary.`
}

function buildEvalPrompt(messages: any[]): string {
  const transcript = messages
    .map(m => `${m.role === 'assistant' ? 'Interviewer' : 'Candidate'}: ${m.content}`)
    .join('\n\n')

  return `Based on this interview transcript, provide a structured evaluation as JSON only (no markdown):

${transcript}

Respond with ONLY this JSON:
{"technical_depth":70,"communication_clarity":75,"problem_approach":68,"red_flags":[],"overall_score":71,"recommendation":"advance","summary":"3-4 sentence objective assessment here"}`
}

export async function startInterview(
  candidate: Candidate,
  round = 1
): Promise<{ session: InterviewSession; firstMessage: string }> {
  const { data: session, error } = await supabaseAdmin
    .from('interview_sessions')
    .insert({
      candidate_id: candidate.id,
      round,
      status: 'active',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create session: ${error.message}`)

  await supabaseAdmin
    .from('candidates')
    .update({ status: 'interviewing' })
    .eq('id', candidate.id)

  const completion = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 512,
    temperature: 0.7,
    messages: [
      { role: 'system', content: buildSystemPrompt(candidate, round) },
      { role: 'user',   content: 'Start the interview with a warm greeting and your first question.' },
    ],
  })

  const firstMessage = completion.choices[0]?.message?.content ?? 'Hello! Ready to begin your interview?'

  await supabaseAdmin.from('interview_messages').insert({
    session_id: session.id,
    role: 'assistant',
    content: firstMessage,
  })

  return {
    session: { ...session, messages: [] },
    firstMessage,
  }
}

export async function handleMessage(
  sessionId: string,
  candidateText: string,
  candidate: Candidate
): Promise<{ reply: string; detection: Awaited<ReturnType<typeof detectAI>>; isComplete: boolean }> {

  const { data: messages } = await supabaseAdmin
    .from('interview_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true })

  const history = messages ?? []

  // Run AI detection on candidate response
  const detection = await detectAI(candidateText)

  await supabaseAdmin.from('interview_messages').insert({
    session_id:    sessionId,
    role:          'candidate',
    content:       candidateText,
    ai_verdict:    detection.verdict,
    ai_confidence: detection.confidence,
    ai_reasoning:  detection.reasoning,
  })

  const { data: session } = await supabaseAdmin
    .from('interview_sessions')
    .select('round')
    .eq('id', sessionId)
    .single()

  // Build message history for Groq
  const groqMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: buildSystemPrompt(candidate, session?.round ?? 1) },
  ]

  for (const m of history) {
    groqMessages.push({
      role:    m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })
  }
  groqMessages.push({ role: 'user', content: candidateText })

  const candidateTurns = history.filter(m => m.role === 'candidate').length + 1
  const shouldWrap     = candidateTurns >= 7

  if (shouldWrap) {
    groqMessages.push({
      role: 'system',
      content: 'This is the final exchange. Wrap up the interview now, thank the candidate warmly, and tell them you will send a summary within 24 hours. Do NOT ask another question.',
    })
  }

  const completion = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 512,
    temperature: 0.7,
    messages: groqMessages,
  })

  const reply = completion.choices[0]?.message?.content ?? 'Thank you for your response.'

  await supabaseAdmin.from('interview_messages').insert({
    session_id: sessionId,
    role:       'assistant',
    content:    reply,
  })

  const isComplete = shouldWrap
  if (isComplete) {
    await completeInterview(sessionId, candidate)
  }

  return { reply, detection, isComplete }
}

export async function completeInterview(
  sessionId: string,
  candidate: Candidate
): Promise<InterviewEvaluation> {
  const { data: messages } = await supabaseAdmin
    .from('interview_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true })

  const completion = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: 'You are a JSON-only evaluation engine. Respond with valid JSON only. No markdown. No text outside the JSON.',
      },
      {
        role: 'user',
        content: buildEvalPrompt(messages as InterviewMessage[]),
      },
    ],
  })

  const raw   = completion.choices[0]?.message?.content ?? '{}'
  const clean = raw.replace(/```json|```/g, '').trim()

  let evaluation: InterviewEvaluation
  try {
    evaluation = JSON.parse(clean)
  } catch {
    const match = clean.match(/\{[\s\S]*\}/)
    evaluation = match ? JSON.parse(match[0]) : {
      technical_depth: 50, communication_clarity: 50, problem_approach: 50,
      red_flags: [], overall_score: 50, recommendation: 'hold', summary: 'Evaluation parsing failed.',
    }
  }

  await supabaseAdmin
    .from('interview_sessions')
    .update({
      status:        'complete',
      completed_at:  new Date().toISOString(),
      tech_score:    evaluation.technical_depth,
      comm_score:    evaluation.communication_clarity,
      approach_score: evaluation.problem_approach,
      overall_score: evaluation.overall_score,
      red_flags:     evaluation.red_flags,
      recommendation: evaluation.recommendation,
      eval_summary:  evaluation.summary,
    })
    .eq('id', sessionId)

  const newStatus = evaluation.recommendation === 'advance' ? 'shortlisted'
    : evaluation.recommendation === 'reject' ? 'rejected'
    : 'interview_complete'

  await supabaseAdmin
    .from('candidates')
    .update({ status: newStatus })
    .eq('id', candidate.id)

  return evaluation
}

export async function getSession(sessionId: string) {
  const { data: session } = await supabaseAdmin
    .from('interview_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  const { data: messages } = await supabaseAdmin
    .from('interview_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true })

  return { session, messages: messages ?? [] }
}