import { NextRequest, NextResponse } from 'next/server'
import { scoreCandidate, batchScoreAndRank } from '@/lib/scorer'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Batch mode
    if (body.batch) {
  try {
    const result = await batchScoreAndRank(body.limit ?? 100)
    return NextResponse.json(result)
  } catch (e) {
    console.error('[batch error full]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

    // Single candidate
    if (!body.candidate_id) {
      return NextResponse.json({ error: 'candidate_id required' }, { status: 400 })
    }

    const { data: candidate, error } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('id', body.candidate_id)
      .single()

    if (error || !candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    const result = await scoreCandidate(candidate)
    return NextResponse.json({ success: true, result })

  } catch (e) {
    console.error('[score]', e)
    return NextResponse.json({ error: 'Scoring failed', detail: String(e) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const candidateId = searchParams.get('candidate_id')

  if (candidateId) {
    const { data } = await supabaseAdmin
      .from('scoring_results')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('scored_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json(data ?? { error: 'Not scored yet' })
  }

  // Return top candidates
  const { data } = await supabaseAdmin
    .from('candidates')
    .select('id, name, email, score, rank, status, skills, years_experience')
    .not('score', 'is', null)
    .order('rank', { ascending: true })
    .limit(parseInt(searchParams.get('limit') ?? '50'))

  return NextResponse.json(data ?? [])
}