import { NextRequest, NextResponse } from 'next/server'
import { recordOutcome, getPerformanceStats } from '@/lib/feedback'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'

const OutcomeSchema = z.object({
  candidate_id: z.string().uuid(),
  decision:     z.enum(['hired', 'rejected', 'no_show', 'withdrew']),
  decided_by:   z.string().min(1),
  notes:        z.string().optional(),
  session_id:   z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const parsed = OutcomeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { candidate_id, decision, decided_by, notes, session_id } = parsed.data

    // Update candidate status immediately so dashboard reflects it
    const newStatus = decision === 'hired'     ? 'shortlisted'
                    : decision === 'rejected'  ? 'rejected'
                    : decision === 'no_show'   ? 'rejected'
                    : 'rejected'

    await supabaseAdmin
      .from('candidates')
      .update({ status: newStatus })
      .eq('id', candidate_id)

    // Log outcome for feedback loop
    await recordOutcome(candidate_id, decision, decided_by, notes, session_id)

    return NextResponse.json({
      success: true,
      status:  newStatus,
      message: `Candidate marked as ${newStatus}.`,
    })
  } catch (e) {
    console.error('[outcomes]', e)
    return NextResponse.json({ error: 'Failed to record outcome', detail: String(e) }, { status: 500 })
  }
}

export async function GET() {
  try {
    const stats = await getPerformanceStats()
    return NextResponse.json(stats ?? { message: 'No outcome data yet' })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}