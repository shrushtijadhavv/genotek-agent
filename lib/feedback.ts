import { supabaseAdmin } from './supabase'

// ─── Record a hiring outcome ──────────────────────────────────────────────────

export async function recordOutcome(
  candidateId: string,
  decision: 'hired' | 'rejected' | 'no_show' | 'withdrew',
  decidedBy: string,
  notes?: string,
  sessionId?: string
) {
  const { error } = await supabaseAdmin
    .from('hiring_outcomes')
    .insert({
      candidate_id: candidateId,
      session_id: sessionId ?? null,
      decision,
      decided_by: decidedBy,
      notes,
    })

  if (error) throw new Error(`Failed to record outcome: ${error.message}`)

  // Trigger weight recalibration if enough data
  const { count } = await supabaseAdmin
    .from('hiring_outcomes')
    .select('*', { count: 'exact', head: true })

  if ((count ?? 0) >= 20) {
    await recalibrateWeights()
  }
}

// ─── Recalibrate scoring weights based on outcomes ───────────────────────────

export async function recalibrateWeights(): Promise<void> {
  // Fetch all outcomes with their scoring results
  const { data: outcomes } = await supabaseAdmin
    .from('hiring_outcomes')
    .select(`
      decision,
      candidate_id,
      candidates (
        id,
        scoring_results (
          skills_match,
          experience,
          communication,
          problem_solving,
          culture_fit,
          red_flags,
          composite
        )
      )
    `)

  if (!outcomes?.length) return

  // Separate hired vs rejected
  const hired   = outcomes.filter(o => o.decision === 'hired')
  const rejected = outcomes.filter(o => o.decision === 'rejected')

  if (hired.length < 5 || rejected.length < 5) return // Not enough data

  // Compute mean scores per dimension for hired vs rejected
  const dims = ['skills_match', 'experience', 'communication', 'problem_solving', 'culture_fit', 'red_flags'] as const

  function meanScores(group: NonNullable<typeof outcomes>) {
    const scores = group
      .map((o: any) => o.candidates?.scoring_results?.[0])
      .filter(Boolean)

    if (!scores.length) return null

    return Object.fromEntries(
      dims.map(d => [d, scores.reduce((sum: number, s: any) => sum + (s[d] ?? 0), 0) / scores.length])
    )
  }

  const hiredMeans   = meanScores(hired)
  const rejectedMeans = meanScores(rejected)

  if (!hiredMeans || !rejectedMeans) return

  // Weight dimension by how much it discriminates hired vs rejected
  const discrimination = Object.fromEntries(
    dims.map(d => [d, Math.abs(hiredMeans[d] - rejectedMeans[d])])
  )

  const totalDisc = Object.values(discrimination).reduce((a, b) => a + b, 0)

  // Normalize to weights that sum to 1
  const newWeights = {
    w_skills:        Math.round((discrimination.skills_match    / totalDisc) * 1000) / 1000,
    w_experience:    Math.round((discrimination.experience      / totalDisc) * 1000) / 1000,
    w_communication: Math.round((discrimination.communication   / totalDisc) * 1000) / 1000,
    w_problem:       Math.round((discrimination.problem_solving / totalDisc) * 1000) / 1000,
    w_culture:       Math.round((discrimination.culture_fit     / totalDisc) * 1000) / 1000,
    w_red_flags:     Math.round((discrimination.red_flags       / totalDisc) * 1000) / 1000,
  }

  // Get current version
  const { data: current } = await supabaseAdmin
    .from('model_weights')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (current?.version ?? 0) + 1

  await supabaseAdmin.from('model_weights').insert({
    version: nextVersion,
    ...newWeights,
    training_n: outcomes.length,
  })

  console.log(`[Feedback] Recalibrated weights → v${nextVersion} with ${outcomes.length} outcomes`)
}

// ─── Get performance stats ────────────────────────────────────────────────────

export async function getPerformanceStats() {
  const { data: outcomes } = await supabaseAdmin
    .from('hiring_outcomes')
    .select('decision, candidate_id, candidates(score)')

  if (!outcomes) return null

  const hired   = outcomes.filter(o => o.decision === 'hired')
  const rejected = outcomes.filter(o => o.decision === 'rejected')

  const avgHiredScore   = hired.reduce((s: number, o: any) => s + (o.candidates?.score ?? 0), 0) / (hired.length || 1)
  const avgRejectedScore = rejected.reduce((s: number, o: any) => s + (o.candidates?.score ?? 0), 0) / (rejected.length || 1)

  // Precision: of those we advanced, what fraction were actually hired?
  const { data: advanced } = await supabaseAdmin
    .from('candidates')
    .select('id, status')
    .in('status', ['shortlisted', 'hired', 'rejected'])

  return {
    total_outcomes: outcomes.length,
    hired_count: hired.length,
    rejected_count: rejected.length,
    avg_hired_score: Math.round(avgHiredScore * 10) / 10,
    avg_rejected_score: Math.round(avgRejectedScore * 10) / 10,
    score_discrimination: Math.round((avgHiredScore - avgRejectedScore) * 10) / 10,
    advanced_count: advanced?.length ?? 0,
  }
}