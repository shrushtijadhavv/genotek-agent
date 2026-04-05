'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function IngestPage() {
  const [tab,      setTab]    = useState<'csv' | 'manual'>('csv')
  const [result,   setResult] = useState<any>(null)
  const [loading,  setLoading] = useState(false)
  const [csvText,  setCsv]    = useState('')

  const [form, setForm] = useState({
    name: '', email: '', phone: '', years_experience: '', skills: '', education: '', resume_text: '',
  })

  async function submitCSV() {
    if (!csvText.trim()) return
    setLoading(true)
    const res  = await fetch('/api/ingest', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ csv_content: csvText }),
    })
    setResult(await res.json())
    setLoading(false)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsv(text)
  }

  async function submitManual() {
    if (!form.name || !form.email || !form.resume_text) return
    setLoading(true)
    const res  = await fetch('/api/ingest', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidates: [{
          ...form,
          years_experience: parseFloat(form.years_experience) || 0,
          skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        }]
      }),
    })
    setResult(await res.json())
    setLoading(false)
  }

  const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', marginBottom: 12 }
  const labelStyle = { fontSize: 13, fontWeight: 500, color: '#444', display: 'block', marginBottom: 4 }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
        <Link href="/" style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>← Dashboard</Link>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Import candidates</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: '1.5rem', background: '#f1f3f4', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {(['csv', 'manual'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 20px', borderRadius: 8, border: 'none', fontSize: 14, cursor: 'pointer',
            background: tab === t ? '#fff' : 'transparent',
            color: tab === t ? '#1a1a1a' : '#666',
            fontWeight: tab === t ? 500 : 400,
            boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>
            {t === 'csv' ? 'CSV / Internshala export' : 'Manual entry'}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: '1.5rem' }}>
        {tab === 'csv' && (
          <>
            <p style={{ fontSize: 14, color: '#666', marginTop: 0, marginBottom: 16 }}>
              Export applicants from Internshala employer dashboard as CSV, then upload or paste below.
              Required columns: <code style={{ background: '#f1f3f4', padding: '1px 5px', borderRadius: 4 }}>Name, Email, Cover Letter</code>
            </p>
            <label style={labelStyle}>Upload CSV file</label>
            <input type="file" accept=".csv" onChange={handleFileUpload} style={{ marginBottom: 16, fontSize: 14 }} />
            <label style={labelStyle}>Or paste CSV content</label>
            <textarea
              value={csvText}
              onChange={e => setCsv(e.target.value)}
              rows={8}
              placeholder="Name,Email,Cover Letter,Skills,Experience&#10;Priya Sharma,priya@example.com,..."
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
            />
            <button onClick={submitCSV} disabled={loading || !csvText.trim()} style={{ padding: '10px 24px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Importing...' : 'Import CSV'}
            </button>
          </>
        )}

        {tab === 'manual' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div>
                <label style={labelStyle}>Full name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="Priya Sharma" />
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} placeholder="priya@example.com" />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} style={inputStyle} placeholder="+91 9876543210" />
              </div>
              <div>
                <label style={labelStyle}>Years of experience</label>
                <input value={form.years_experience} onChange={e => setForm(p => ({ ...p, years_experience: e.target.value }))} style={inputStyle} placeholder="2.5" type="number" step="0.5" />
              </div>
            </div>
            <label style={labelStyle}>Skills (comma-separated)</label>
            <input value={form.skills} onChange={e => setForm(p => ({ ...p, skills: e.target.value }))} style={inputStyle} placeholder="React, Node.js, Python, Claude API" />
            <label style={labelStyle}>Education</label>
            <input value={form.education} onChange={e => setForm(p => ({ ...p, education: e.target.value }))} style={inputStyle} placeholder="B.Tech Computer Science, IIT Bombay" />
            <label style={labelStyle}>Resume / Cover letter *</label>
            <textarea
              value={form.resume_text}
              onChange={e => setForm(p => ({ ...p, resume_text: e.target.value }))}
              rows={6}
              placeholder="Paste resume text or cover letter here..."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <button
              onClick={submitManual}
              disabled={loading || !form.name || !form.email || !form.resume_text}
              style={{ padding: '10px 24px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Saving...' : 'Add candidate'}
            </button>
          </>
        )}
      </div>

      {result && (
        <div style={{ marginTop: 16, padding: '1rem 1.25rem', background: result.errors?.length ? '#fef3c7' : '#f0fdf4', border: `1px solid ${result.errors?.length ? '#fcd34d' : '#86efac'}`, borderRadius: 12, fontSize: 14 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: result.errors?.length ? '#92400e' : '#166534' }}>
            Import complete
          </div>
          <div>Imported: <strong>{result.imported}</strong> · Skipped: <strong>{result.skipped}</strong></div>
          {result.errors?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {result.errors.map((e: string, i: number) => <div key={i} style={{ color: '#c5221f', fontSize: 13 }}>{e}</div>)}
            </div>
          )}
          {result.imported > 0 && (
            <div style={{ marginTop: 10 }}>
              <Link href="/" style={{ fontSize: 13, color: '#1a73e8' }}>Go to dashboard to score them →</Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}