'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Message {
  role: 'assistant' | 'candidate'
  content: string
  detection?: {
    verdict: string
    confidence: number
    flags: { description: string; severity: string }[]
  }
}

interface Session {
  id: string
  status: string
  round: number
  overall_score?: number
  recommendation?: string
  eval_summary?: string
}

export default function InterviewPage() {
  const params      = useSearchParams()
  const candidateId = params.get('candidate_id')

  const [session,   setSession]   = useState<Session | null>(null)
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [sending,   setSending]   = useState(false)
  const [starting,  setStarting]  = useState(false)
  const [candidate, setCandidate] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (candidateId) fetchCandidate()
  }, [candidateId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchCandidate() {
    const res  = await fetch(`/api/score?candidate_id=${candidateId}`)
    // also fetch basic info
    const res2 = await fetch(`/api/interview?candidate_id=${candidateId}`)
    const sessions = await res2.json()
    if (sessions?.length > 0 && sessions[0].status === 'active') {
      const s = sessions[0]
      setSession(s)
      const histRes  = await fetch(`/api/interview?session_id=${s.id}`)
      const histData = await histRes.json()
      setMessages((histData.messages ?? []).map((m: any) => ({ role: m.role, content: m.content })))
    }
  }

  async function startSession() {
    if (!candidateId) return
    setStarting(true)
    const res  = await fetch('/api/interview', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'start', candidate_id: candidateId, round: 1 }),
    })
    const data = await res.json()
    setSession(data.session)
    setMessages([{ role: 'assistant', content: data.firstMessage }])
    setStarting(false)
  }

  async function sendMessage() {
    if (!input.trim() || !session || sending) return
    const text = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'candidate', content: text }])
    setSending(true)

    const res  = await fetch('/api/interview', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'message', session_id: session.id, message: text }),
    })
    const data = await res.json()

    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: data.reply, detection: data.detection },
    ])

    if (data.isComplete) {
      setSession(prev => prev ? { ...prev, status: 'complete' } : prev)
    }
    setSending(false)
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
        <Link href="/" style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>← Dashboard</Link>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Interview Room</h1>
        {session && (
          <span style={{ marginLeft: 'auto', fontSize: 12, padding: '3px 10px', background: session.status === 'complete' ? '#e6f4ea' : '#f3e8ff', color: session.status === 'complete' ? '#1e7e34' : '#7c3aed', borderRadius: 999 }}>
            {session.status === 'complete' ? 'Complete' : `Round ${session.round} · Active`}
          </span>
        )}
      </div>

      {!session && !starting && (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: 12, border: '1px solid #e8e8e8' }}>
          <p style={{ color: '#666', marginBottom: 20, fontSize: 15 }}>Ready to start the autonomous interview for this candidate?</p>
          <button
            onClick={startSession}
            style={{ padding: '10px 28px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}
          >
            Start interview
          </button>
        </div>
      )}

      {starting && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666', fontSize: 14 }}>Starting interview session...</div>
      )}

      {session && (
        <>
          {/* Chat messages */}
          <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: '1.25rem', minHeight: 400, maxHeight: 520, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'candidate' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontSize: 14,
                  lineHeight: 1.6,
                  background: m.role === 'candidate' ? '#eef2ff' : '#f8f9fa',
                  color: m.role === 'candidate' ? '#3730a3' : '#1a1a1a',
                  border: m.role === 'candidate' ? '1px solid #c7d2fe' : '1px solid #e8e8e8',
                }}>
                  {m.content}
                </div>
                {/* AI detection badge for candidate messages */}
                {m.role === 'candidate' && m.detection && m.detection.verdict !== 'human' && (
                  <div style={{ marginTop: 4, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: m.detection.verdict === 'ai_generated' ? '#fce8e6' : '#fef3c7', color: m.detection.verdict === 'ai_generated' ? '#c5221f' : '#92400e' }}>
                    {m.detection.verdict === 'ai_generated' ? 'AI-generated detected' : 'Possible AI assistance'} ({Math.round(m.detection.confidence * 100)}% confidence)
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#999', animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, color: '#999' }}>Agent thinking...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {session.status === 'active' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Type your answer..."
                disabled={sending}
                style={{ flex: 1, padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff' }}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                style={{ padding: '10px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', opacity: sending || !input.trim() ? 0.5 : 1 }}
              >
                Send
              </button>
            </div>
          )}

          {/* Evaluation summary */}
          {session.status === 'complete' && session.eval_summary && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '1rem 1.25rem', marginTop: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: '#166534' }}>Interview complete — evaluation</div>
              <p style={{ fontSize: 14, color: '#166534', margin: 0, lineHeight: 1.6 }}>{session.eval_summary}</p>
              <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 13 }}>Score: <strong>{session.overall_score}</strong></span>
                <span style={{ fontSize: 13 }}>Recommendation: <strong style={{ color: session.recommendation === 'advance' ? '#1e7e34' : '#c5221f' }}>{session.recommendation}</strong></span>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes pulse { 0%,80%,100%{opacity:.2} 40%{opacity:1} }`}</style>
    </div>
  )
}