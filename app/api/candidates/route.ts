import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// DELETE all candidates and related data
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const candidateId = searchParams.get('id')

    if (candidateId) {
      // Delete single candidate
      const { error } = await supabaseAdmin
        .from('candidates')
        .delete()
        .eq('id', candidateId)

      if (error) throw new Error(error.message)
      return NextResponse.json({ success: true, message: 'Candidate deleted.' })
    }

    // Delete ALL — cascade handles related rows (scores, sessions, messages)
    const { error } = await supabaseAdmin
      .from('candidates')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // matches all rows

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true, message: 'All candidates deleted.' })

  } catch (e) {
    console.error('[delete candidates]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PATCH — update a single candidate's status
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('candidates')
      .update({ status: body.status, score: body.score ?? undefined })
      .eq('id', body.id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}