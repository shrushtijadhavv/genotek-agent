import { parse } from 'csv-parse/sync'
import { supabaseAdmin } from './supabase'
import type { Candidate, IngestResponse } from '@/types'

// ─── Map Internshala CSV columns to our schema ────────────────────────────────
// Internshala exports vary — these are the most common column names.
// Adjust field names to match your actual export.

interface IntershalRow {
  'Name'?: string
  'Email'?: string
  'Phone'?: string
  'Cover Letter'?: string
  'Resume'?: string
  'Skills'?: string
  'Experience'?: string
  'Education'?: string
  [key: string]: string | undefined
}

function parseExperience(raw?: string): number {
  if (!raw) return 0
  const match = raw.match(/(\d+(\.\d+)?)/)
  return match ? parseFloat(match[1]) : 0
}

function parseSkills(raw?: string): string[] {
  if (!raw) return []
  return raw.split(/[,;|]/).map(s => s.trim()).filter(Boolean)
}

function mapRow(row: IntershalRow): Partial<Candidate> | null {
  const name  = row['Name']?.trim()
  const email = row['Email']?.trim()?.toLowerCase()

  if (!name || !email) return null

  const resumeText = [
    row['Cover Letter'] ?? '',
    row['Resume'] ?? '',
  ].join('\n\n').trim()

  if (resumeText.length < 50) return null // Skip empty applications

  return {
    name,
    email,
    phone:            row['Phone']?.trim(),
    resume_text:      resumeText,
    years_experience: parseExperience(row['Experience']),
    skills:           parseSkills(row['Skills']),
    education:        row['Education']?.trim(),
    source:           'internshala',
    applied_at:       new Date().toISOString(),
    status:           'pending',
  }
}

// ─── Parse CSV string and insert candidates ───────────────────────────────────

export async function ingestCSV(csvContent: string): Promise<IngestResponse> {
  let rows: IntershalRow[]

  try {
    rows = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
  } catch (e) {
    return { imported: 0, skipped: 0, errors: [`CSV parse failed: ${(e as Error).message}`], candidate_ids: [] }
  }

  const candidateIds: string[] = []
  let skipped = 0
  const errors: string[] = []

  // Process in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const mapped = batch.map(mapRow).filter(Boolean) as Partial<Candidate>[]

    if (!mapped.length) { skipped += batch.length; continue }

    const { data, error } = await supabaseAdmin
      .from('candidates')
      .upsert(mapped, {
        onConflict: 'email',
        ignoreDuplicates: false,
      })
      .select('id')

    if (error) {
      errors.push(`Batch ${i / 50 + 1}: ${error.message}`)
      skipped += batch.length
    } else {
      data?.forEach(c => candidateIds.push(c.id))
      skipped += batch.length - (data?.length ?? 0)
    }
  }

  return {
    imported: candidateIds.length,
    skipped,
    errors,
    candidate_ids: candidateIds,
  }
}

// ─── Ingest raw candidate objects (from form/API) ─────────────────────────────

export async function ingestCandidates(candidates: Partial<Candidate>[]): Promise<IngestResponse> {
  const valid = candidates.filter(c => c.name && c.email && c.resume_text)
  const skipped = candidates.length - valid.length
  const errors: string[] = []

  const { data, error } = await supabaseAdmin
    .from('candidates')
    .upsert(
      valid.map(c => ({ ...c, source: c.source ?? 'api', status: 'pending' })),
      { onConflict: 'email', ignoreDuplicates: false }
    )
    .select('id')

  if (error) {
    errors.push(error.message)
    return { imported: 0, skipped: candidates.length, errors, candidate_ids: [] }
  }

  return {
    imported: data?.length ?? 0,
    skipped,
    errors,
    candidate_ids: data?.map(c => c.id) ?? [],
  }
}