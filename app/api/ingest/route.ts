import { NextRequest, NextResponse } from 'next/server'
import { ingestCSV, ingestCandidates } from '@/lib/ingest'
import { z } from 'zod'

const JsonBody = z.object({
  candidates: z.array(z.object({
    name:             z.string(),
    email:            z.string().email(),
    resume_text:      z.string().min(50),
    years_experience: z.number().optional(),
    skills:           z.array(z.string()).optional(),
    education:        z.string().optional(),
    phone:            z.string().optional(),
  })).optional(),
  csv_content: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      const csv = await file.text()
      const result = await ingestCSV(csv)
      return NextResponse.json(result)
    }

    const body = await req.json()
    const parsed = JsonBody.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    if (parsed.data.csv_content) {
      const result = await ingestCSV(parsed.data.csv_content)
      return NextResponse.json(result)
    }

    if (parsed.data.candidates) {
      const result = await ingestCandidates(parsed.data.candidates as any)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Provide csv_content or candidates array' }, { status: 400 })
  } catch (e) {
    console.error('[ingest]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}