import { NextRequest, NextResponse } from 'next/server'
import { startInterview, handleMessage, getSession } from '@/lib/interviewer'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Start a new session
    if (body.action === 'start') {
      if (!body.candidate_id) return NextResponse.json({ error: 'candidate_id required' }, { status: 400 })

      const { data: candidate } = await supabaseAdmin
        .from('candidates')
        .select('*')
        .eq('id', body.candidate_id)
        .single()

      if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

      const result = await startInterview(candidate, body.round ?? 1)
      return NextResponse.json(result)
    }

    // Send a message in an existing session
    if (body.action === 'message') {
      if (!body.session_id || !body.message) {
        return NextResponse.json({ error: 'session_id and message required' }, { status: 400 })
      }

      // Fetch session + candidate
      const { data: session } = await supabaseAdmin
        .from('interview_sessions')
        .select('*, candidates(*)')
        .eq('id', body.session_id)
        .single()

      if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      if (session.status !== 'active') {
        return NextResponse.json({ error: 'Session is not active', status: session.status }, { status: 400 })
      }

      const result = await handleMessage(body.session_id, body.message, session.candidates)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Unknown action. Use "start" or "message"' }, { status: 400 })

  } catch (e) {
    console.error('[interview]', e)
    return NextResponse.json({ error: 'Interview error', detail: String(e) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId   = searchParams.get('session_id')
  const candidateId = searchParams.get('candidate_id')

  if (sessionId) {
    const data = await getSession(sessionId)
    return NextResponse.json(data)
  }

  if (candidateId) {
    const { data } = await supabaseAdmin
      .from('interview_sessions')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
    return NextResponse.json(data ?? [])
  }

  // Return active sessions
  const { data } = await supabaseAdmin
    .from('interview_sessions')
    .select('*, candidates(name, email, score)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json(data ?? [])
}