import { NextRequest, NextResponse } from 'next/server'
import { detectAI } from '@/lib/aidetect'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.text) {
      return NextResponse.json({ error: 'text field required' }, { status: 400 })
    }

    const result = await detectAI(body.text)

    // Optionally log to DB if candidate/session provided
    if (body.candidate_id) {
      await supabaseAdmin.from('ai_detection_logs').insert({
        candidate_id: body.candidate_id,
        session_id:   body.session_id ?? null,
        text_snippet: body.text.slice(0, 500),
        verdict:      result.verdict,
        confidence:   result.confidence,
        flags:        result.flags,
        perplexity:   result.perplexity_score,
        avg_sent_len: result.avg_sentence_length,
        reasoning:    result.reasoning,
      })
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('[detect]', e)
    return NextResponse.json({ error: 'Detection failed', detail: String(e) }, { status: 500 })
  }
}