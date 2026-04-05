'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Candidate {
  id: string
  name: string
  email: string
  score: number
  rank: number
  status: string
  skills: string[]
  years_experience: number
}

interface Stats {
  total: number
  scored: number
  interviewing: number
  shortlisted: number
  ai_flagged: number
}

const STATUS_BADGE: Record<string, string> = {
  pending:             'badge-gray',
  scored:              'badge-blue',
  interview_scheduled: 'badge-blue',
  interviewing:        'badge-purple',
  interview_complete:  'badge-blue',
  shortlisted:         'badge-green',
  rejected:            'badge-red',
  hired:               'badge-green',
}

export default function Dashboard() {
  const [candidates,   setCandidates]   = useState<Candidate[]>([])
  const [flagged,      setFlagged]      = useState<Candidate[]>([])
  const [stats,        setStats]        = useState<Stats>({ total: 0, scored: 0, interviewing: 0, shortlisted: 0, ai_flagged: 0 })
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState<string>('all')
  const [batchRunning, setBatch]        = useState(false)
  const [msg,          setMsg]          = useState('')
  const [actionMsg,    setActionMsg]    = useState('')

  async function load() {
    setLoading(true)

    const [scoreRes, flagRes] = await Promise.all([
      fetch('/api/score?limit=200'),
      fetch('/api/flagged'),
    ])

    const allData: Candidate[]     = await scoreRes.json().then((d: any) => Array.isArray(d) ? d : [])
    const flaggedData: Candidate[] = await flagRes.json().then((d: any) => Array.isArray(d) ? d : [])

    setCandidates(allData)
    setFlagged(flaggedData)
    setStats({
      total:        allData.length,
      scored:       allData.filter((c: Candidate) => c.score).length,
      interviewing: allData.filter((c: Candidate) => c.status === 'interviewing').length,
      shortlisted:  allData.filter((c: Candidate) => c.status === 'shortlisted' || c.status === 'hired').length,
      ai_flagged:   flaggedData.length,
    })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function runBatchScore() {
    setBatch(true)
    setMsg('Scoring pending candidates...')
    const res  = await fetch('/api/score', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ batch: true, limit: 50 }),
    })
    const data = await res.json()
    setMsg(`Done — ${data.processed} scored, ${data.errors} errors.`)
    setBatch(false)
    load()
  }

  async function updateStatus(candidateId: string, decision: 'hired' | 'rejected') {
    const res = await fetch('/api/outcomes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ candidate_id: candidateId, decision, decided_by: 'hr-dashboard' }),
    })
    if (res.ok) {
      setActionMsg(decision === 'hired' ? '✓ Candidate shortlisted' : '✗ Candidate rejected')
      setTimeout(() => setActionMsg(''), 3000)
      load()
    }
  }

  // Which list to show
  const displayed = filter === 'ai_flagged'
    ? flagged
    : filter === 'all'
    ? candidates
    : candidates.filter(c => c.status === filter)

  const flaggedIds = new Set(flagged.map(f => f.id))

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>GenoTek Hiring Agent</h1>
          <p style={{ color: '#666', margin: '4px 0 0', fontSize: 14 }}>Autonomous AI hiring pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/ingest" style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 8, textDecoration: 'none', color: '#333', fontSize: 14 }}>
            Import candidates
          </Link>
          <button
            onClick={runBatchScore}
            disabled={batchRunning}
            style={{ padding: '8px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', opacity: batchRunning ? 0.7 : 1 }}
          >
            {batchRunning ? 'Scoring...' : 'Run batch score'}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: 14, marginBottom: 12, color: '#166534' }}>{msg}</div>
      )}
      {actionMsg && (
        <div style={{ padding: '10px 14px', background: actionMsg.startsWith('✓') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${actionMsg.startsWith('✓') ? '#86efac' : '#fca5a5'}`, borderRadius: 8, fontSize: 14, marginBottom: 12, color: actionMsg.startsWith('✓') ? '#166534' : '#991b1b', fontWeight: 500 }}>
          {actionMsg}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Total',        value: stats.total,        color: '#1a1a1a',  key: 'all'         },
          { label: 'Scored',       value: stats.scored,       color: '#1a73e8',  key: 'scored'      },
          { label: 'Interviewing', value: stats.interviewing, color: '#7c3aed',  key: 'interviewing'},
          { label: 'Shortlisted',  value: stats.shortlisted,  color: '#1e7e34',  key: 'shortlisted' },
          { label: 'AI flagged',   value: stats.ai_flagged,   color: '#c5221f',  key: 'ai_flagged'  },
        ].map(s => (
          <div
            key={s.label}
            onClick={() => setFilter(s.key)}
            style={{
              background:   '#fff',
              border:       `1px solid ${filter === s.key ? s.color : '#e8e8e8'}`,
              borderRadius: 12,
              padding:      '1rem',
              cursor:       'pointer',
              transition:   'border-color 0.15s',
            }}
          >
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 600, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'all',          label: 'All' },
          { key: 'pending',      label: 'Pending' },
          { key: 'scored',       label: 'Scored' },
          { key: 'interviewing', label: 'Interviewing' },
          { key: 'shortlisted',  label: 'Shortlisted' },
          { key: 'rejected',     label: 'Rejected' },
          { key: 'ai_flagged',   label: `🚩 AI flagged (${stats.ai_flagged})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding:     '5px 14px',
              borderRadius: 999,
              fontSize:    13,
              cursor:      'pointer',
              border:      '1px solid',
              borderColor: filter === f.key ? (f.key === 'ai_flagged' ? '#fca5a5' : '#4f46e5') : '#ddd',
              background:  filter === f.key ? (f.key === 'ai_flagged' ? '#fef2f2' : '#eef2ff') : '#fff',
              color:       filter === f.key ? (f.key === 'ai_flagged' ? '#991b1b' : '#4f46e5') : '#555',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* AI flagged explanation banner */}
      {filter === 'ai_flagged' && (
        <div style={{ padding: '10px 14px', background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, fontSize: 13, marginBottom: 16, color: '#713f12' }}>
          These candidates had AI-generated responses detected during their interview. Detection uses heuristic pattern matching + LLM analysis. Review manually before making a final decision.
        </div>
      )}

      {/* Candidate table */}
      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafafa', borderBottom: '1px solid #e8e8e8' }}>
              {['Rank', 'Name', 'Skills', 'Exp', 'Score', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 13, fontWeight: 500, color: '#555' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 14 }}>Loading candidates...</td></tr>
            )}
            {!loading && displayed.length === 0 && filter === 'ai_flagged' && (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', fontSize: 14 }}>
                  <div style={{ color: '#999', marginBottom: 8 }}>No AI-flagged candidates yet.</div>
                  <div style={{ color: '#bbb', fontSize: 13 }}>AI detection runs automatically during interviews. Start an interview with a candidate to see detection in action.</div>
                </td>
              </tr>
            )}
            {!loading && displayed.length === 0 && filter !== 'ai_flagged' && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 14 }}>No candidates found.</td></tr>
            )}
            {displayed.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0', background: flaggedIds.has(c.id) ? '#fffbeb' : 'transparent' }}>
                <td style={{ padding: '10px 14px', fontSize: 13, color: '#999' }}>#{c.rank ?? '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>{c.email}</div>
                    </div>
                    {flaggedIds.has(c.id) && (
                      <span title="AI-generated response detected" style={{ fontSize: 11, padding: '2px 6px', background: '#fef2f2', color: '#991b1b', borderRadius: 4, border: '1px solid #fca5a5', whiteSpace: 'nowrap' }}>
                        🚩 AI flagged
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(c.skills ?? []).slice(0, 3).map(s => (
                      <span key={s} style={{ fontSize: 11, padding: '2px 6px', background: '#f1f3f4', borderRadius: 4, color: '#555' }}>{s}</span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{c.years_experience}y</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 60, height: 6, background: '#f0f0f0', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${c.score ?? 0}%`, background: (c.score ?? 0) >= 75 ? '#1e7e34' : (c.score ?? 0) >= 50 ? '#f59e0b' : '#c5221f', borderRadius: 999 }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c.score ?? '—'}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span className={`badge ${STATUS_BADGE[c.status] ?? 'badge-gray'}`}>{c.status.replace(/_/g, ' ')}</span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Link
                      href={`/interview?candidate_id=${c.id}`}
                      style={{ fontSize: 12, padding: '5px 10px', border: '1px solid #ddd', borderRadius: 6, textDecoration: 'none', color: '#333', whiteSpace: 'nowrap' }}
                    >
                      Interview
                    </Link>
                    {c.status !== 'shortlisted' && c.status !== 'hired' && (
                      <button
                        onClick={() => updateStatus(c.id, 'hired')}
                        style={{ fontSize: 12, padding: '5px 10px', border: '1px solid #86efac', borderRadius: 6, background: '#f0fdf4', cursor: 'pointer', color: '#166534', fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        ✓ Shortlist
                      </button>
                    )}
                    {c.status !== 'rejected' && (
                      <button
                        onClick={() => updateStatus(c.id, 'rejected')}
                        style={{ fontSize: 12, padding: '5px 10px', border: '1px solid #fca5a5', borderRadius: 6, background: '#fef2f2', cursor: 'pointer', color: '#991b1b', fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        ✗ Reject
                      </button>
                    )}
                    {(c.status === 'shortlisted' || c.status === 'hired') && (
                      <span style={{ fontSize: 12, padding: '5px 10px', background: '#f0fdf4', color: '#166534', borderRadius: 6, border: '1px solid #86efac' }}>✓ Shortlisted</span>
                    )}
                    {c.status === 'rejected' && (
                      <span style={{ fontSize: 12, padding: '5px 10px', background: '#fef2f2', color: '#991b1b', borderRadius: 6, border: '1px solid #fca5a5' }}>✗ Rejected</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}