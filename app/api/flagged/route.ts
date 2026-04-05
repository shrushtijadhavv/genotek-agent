import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const countOnly = searchParams.get('count') === 'true'

  // Messages flagged as AI-generated during interviews
  const { data: flaggedMessages } = await supabaseAdmin
    .from('interview_messages')
    .select('session_id, ai_verdict, ai_confidence, interview_sessions(candidate_id)')
    .in('ai_verdict', ['ai_generated', 'mixed'])
    .gte('ai_confidence', 0.5)

  // Scores flagged as AI-detected
  const { data: flaggedScores } = await supabaseAdmin
    .from('scoring_results')
    .select('candidate_id')
    .eq('ai_detected', true)

  const candidateIds = new Set([
    ...(flaggedMessages ?? []).map((m: any) => m.interview_sessions?.candidate_id).filter(Boolean),
    ...(flaggedScores   ?? []).map((s: any) => s.candidate_id),
  ])

  if (countOnly) {
    return NextResponse.json({ count: candidateIds.size })
  }

  if (!candidateIds.size) return NextResponse.json([])

  const { data: candidates } = await supabaseAdmin
    .from('candidates')
    .select('id, name, email, score, rank, status, skills, years_experience')
    .in('id', Array.from(candidateIds))

  return NextResponse.json(candidates ?? [])
}