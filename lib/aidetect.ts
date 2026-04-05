import { groq, FAST_MODEL } from './anthropic'
import type { AIDetectionResult, AIDetectionFlag } from '@/types'

// ─── Patterns that appear heavily in AI-generated text ────────────────────────

const AI_PATTERNS: Array<{ pattern: RegExp; description: string; severity: 'low' | 'medium' | 'high' }> = [
  // ── Ultra-high confidence AI phrases ──────────────────────────────────────
  { pattern: /great question/i,                                     description: 'AI sycophantic opener',               severity: 'high' },
  { pattern: /\bdelve\b/i,                                          description: 'Classic AI filler verb',              severity: 'high' },
  { pattern: /certainly[!,\s]/i,                                    description: 'AI affirmation opener',               severity: 'high' },
  { pattern: /absolutely[!,\s]/i,                                   description: 'AI affirmation opener',               severity: 'high' },
  { pattern: /of course[!,\s]/i,                                    description: 'AI affirmation opener',               severity: 'high' },
  { pattern: /\bsure[!,\s]/i,                                       description: 'AI affirmation opener',               severity: 'high' },
  { pattern: /in today.s (fast.paced|rapidly evolving|dynamic|ever.changing|digital)/i, description: 'Generic AI opener', severity: 'high' },
  { pattern: /in conclusion/i,                                      description: 'AI essay conclusion',                 severity: 'high' },
  { pattern: /it is (important|worth|essential) to note/i,          description: 'AI hedging opener',                   severity: 'high' },
  { pattern: /it.s worth noting/i,                                  description: 'AI hedging phrase',                   severity: 'high' },
  { pattern: /one of the (key|main|most important|primary)/i,       description: 'AI list intro phrase',                severity: 'high' },
  { pattern: /I (am|would be) (happy|glad|excited|thrilled) to/i,  description: 'AI pleasantry opener',                severity: 'high' },
  { pattern: /hope this helps/i,                                    description: 'AI closing phrase',                   severity: 'high' },
  { pattern: /firstly.{0,300}secondly/is,                           description: 'AI enumeration pattern',              severity: 'high' },
  { pattern: /with that (said|being said)/i,                        description: 'AI transition phrase',                severity: 'high' },
  { pattern: /to summarize|to recap|to reiterate/i,                 description: 'AI summary opener',                   severity: 'high' },
  { pattern: /as an? (AI|language model|AI assistant)/i,            description: 'AI self-reference',                   severity: 'high' },
  { pattern: /\bI (hope|trust) (this|that|you)\b/i,                 description: 'AI closing courtesy',                 severity: 'high' },
  { pattern: /feel free to (ask|reach out|let me know)/i,           description: 'AI closing invitation',               severity: 'high' },
  { pattern: /let me know if you (have|need|want)/i,                description: 'AI closing phrase',                   severity: 'high' },
  { pattern: /\bmy (passion for|journey in|mission is)\b/i,         description: 'AI motivational language',            severity: 'high' },
  { pattern: /\bI would be remiss\b/i,                              description: 'AI formal opener',                    severity: 'high' },

  // ── Medium signals ─────────────────────────────────────────────────────────
  { pattern: /\bleverage\b/i,                                       description: 'AI business jargon',                  severity: 'medium' },
  { pattern: /\bseamlessly\b/i,                                     description: 'AI-favored adverb',                   severity: 'medium' },
  { pattern: /\brobust\b/i,                                         description: 'AI-favored adjective',                severity: 'medium' },
  { pattern: /tailored (to|for)\b/i,                                description: 'AI-favored phrase',                   severity: 'medium' },
  { pattern: /navigate (the|this|these|complex)/i,                  description: 'AI metaphor pattern',                 severity: 'medium' },
  { pattern: /(passionate|enthusiastic) about\b/i,                  description: 'AI motivational cliché',              severity: 'medium' },
  { pattern: /\bfacilitate\b/i,                                     description: 'AI corporate verb',                   severity: 'medium' },
  { pattern: /\bfoster(ing)?\b/i,                                   description: 'AI corporate verb',                   severity: 'medium' },
  { pattern: /comprehensive (understanding|approach|solution)/i,    description: 'AI compound phrase',                  severity: 'medium' },
  { pattern: /\bproactive(ly)?\b/i,                                 description: 'AI corporate buzzword',               severity: 'medium' },
  { pattern: /\bempower(ing|ment)?\b/i,                             description: 'AI motivational word',                severity: 'medium' },
  { pattern: /innovative (solution|approach|framework)/i,           description: 'AI buzzword compound',                severity: 'medium' },
  { pattern: /\bstakeholder(s)?\b/i,                                description: 'AI corporate jargon',                 severity: 'medium' },
  { pattern: /\bmoreover\b/i,                                       description: 'AI essay connector',                  severity: 'medium' },
  { pattern: /\bfurthermore\b/i,                                    description: 'AI essay connector',                  severity: 'medium' },
  { pattern: /\bnevertheless\b/i,                                   description: 'AI essay connector',                  severity: 'medium' },
  { pattern: /\butilize\b/i,                                        description: 'AI formal substitute for "use"',       severity: 'medium' },
  { pattern: /\bsynerg(y|ies|istic)\b/i,                            description: 'AI/corporate buzzword',               severity: 'medium' },

  // ── Low signals ────────────────────────────────────────────────────────────
  { pattern: /\boptimize\b/i,                                       description: 'AI-favored verb',                     severity: 'low' },
  { pattern: /\bstreamline\b/i,                                     description: 'AI-favored verb',                     severity: 'low' },
  { pattern: /\bscalable\b/i,                                       description: 'AI tech buzzword',                    severity: 'low' },
  { pattern: /\bthus\b/i,                                           description: 'AI formal connector',                 severity: 'low' },
  { pattern: /\bpivot(al|ing)?\b/i,                                 description: 'AI startup word',                     severity: 'low' },
]

// ─── Human markers — things real humans do that AI almost never does ──────────

interface HumanMarkers {
  hasEmoji: boolean
  hasDash: boolean          // em/en dash or hyphen used informally
  hasEllipsis: boolean      // "..." trailing off
  hasExclamation: boolean   // multiple !! or casual !
  hasSlang: boolean
  hasTypo: boolean          // repeated letters like "sooo", "heyy"
  hasCasualAbbrev: boolean  // lol, tbh, imo, ngl, idk, btw, rn
  hasParenthetical: boolean // (like this) asides
  score: number             // 0–1, higher = more human
}

function detectHumanMarkers(text: string): HumanMarkers {
  const hasEmoji        = /[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(text)
  const hasDash         = /\s[-–—]\s/.test(text)
  const hasEllipsis     = /\.{3}/.test(text)
  const hasExclamation  = /!{2,}/.test(text) || /\b\w+![^"']/.test(text)
  const hasSlang        = /\b(gonna|wanna|gotta|kinda|sorta|dunno|yeah|yep|nope|hey|ok|okay)\b/i.test(text)
  const hasTypo         = /\b\w*(.)\1{2,}\w*\b/.test(text) // sooo, heyyyy
  const hasCasualAbbrev = /\b(lol|lmao|tbh|imo|ngl|idk|btw|rn|irl|irl|smh|omg|wtf|fr|nvm)\b/i.test(text)
  const hasParenthetical = /\([^)]{3,40}\)/.test(text)

  const count = [hasEmoji, hasDash, hasEllipsis, hasExclamation, hasSlang, hasTypo, hasCasualAbbrev, hasParenthetical]
    .filter(Boolean).length

  return {
    hasEmoji, hasDash, hasEllipsis, hasExclamation,
    hasSlang, hasTypo, hasCasualAbbrev, hasParenthetical,
    score: Math.min(1, count * 0.2), // each marker adds 0.2 to human score
  }
}

interface TextStats {
  avgSentenceLength: number
  sentenceVariance: number
  uniqueWordRatio: number
}

function analyzeTextStats(text: string): TextStats {
  const sentences   = text.match(/[^.!?]+[.!?]+/g) ?? [text]
  const words       = text.toLowerCase().split(/\s+/).filter(Boolean)
  const uniqueWords = new Set(words)

  const sentLengths = sentences.map(s => s.trim().split(/\s+/).length)
  const avgSentLen  = sentLengths.reduce((a, b) => a + b, 0) / (sentLengths.length || 1)
  const variance    = sentLengths.reduce((sum, l) => sum + Math.pow(l - avgSentLen, 2), 0) / (sentLengths.length || 1)

  return {
    avgSentenceLength: avgSentLen,
    sentenceVariance:  variance,
    uniqueWordRatio:   uniqueWords.size / (words.length || 1),
  }
}

function estimatePerplexity(text: string): number {
  const words        = text.toLowerCase().split(/\s+/).filter(Boolean)
  const bigrams      = new Map<string, number>()
  const totalBigrams = words.length - 1

  for (let i = 0; i < words.length - 1; i++) {
    const bg = `${words[i]} ${words[i + 1]}`
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1)
  }

  const uniqueBigrams   = bigrams.size
  const repetitionRatio = 1 - (uniqueBigrams / (totalBigrams || 1))
  return Math.round((1 - repetitionRatio) * 100)
}

async function groqDetect(text: string): Promise<{ verdict: string; reasoning: string; confidence: number }> {
  try {
    const completion = await groq.chat.completions.create({
      model: FAST_MODEL,
      max_tokens: 200,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: 'You are a strict AI-text detector. Default to flagging as AI unless strong human signals exist. Respond JSON only.',
        },
        {
          role: 'user',
          content: `Was this interview response written by AI (ChatGPT/Claude/Gemini) or a human?

AI signals: formal tone, buzzwords, "Great question", "Certainly", "delve", "leverage", "seamlessly", "robust", perfect structure, no typos, generic examples, closing with "feel free to ask", "hope this helps".

Human signals: emojis, dashes (—), "...", typos, slang (gonna/kinda/tbh), casual tone, specific personal stories, "!!", informal openers.

Text:
"""
${text.slice(0, 1000)}
"""

JSON only (no markdown):
{"verdict":"ai_generated","confidence":0.9,"reasoning":"One sentence"}`,
        },
      ],
    })

    const raw   = completion.choices[0]?.message?.content ?? '{}'
    const clean = raw.replace(/```json|```/g, '').trim()
    try {
      return JSON.parse(clean)
    } catch {
      const match = clean.match(/\{[\s\S]*\}/)
      return match ? JSON.parse(match[0]) : { verdict: 'human', reasoning: '', confidence: 0.3 }
    }
  } catch {
    return { verdict: 'human', reasoning: 'Detection unavailable', confidence: 0.3 }
  }
}

export async function detectAI(text: string): Promise<AIDetectionResult> {
  if (!text || text.trim().length < 20) {
    return {
      verdict: 'human', confidence: 0.3, flags: [],
      perplexity_score: 50, avg_sentence_length: 0,
      reasoning: 'Text too short to analyze.',
    }
  }

  // Run all checks
  const flags        = AI_PATTERNS.filter(p => p.pattern.test(text))
    .map(p => ({ pattern: p.pattern.source, description: p.description, severity: p.severity }))
  const stats        = analyzeTextStats(text)
  const perplexity   = estimatePerplexity(text)
  const humanMarkers = detectHumanMarkers(text)

  // Statistical flags
  if (stats.avgSentenceLength > 20)
    flags.push({ pattern: 'avg_sentence_length', description: `Long avg sentences (${stats.avgSentenceLength.toFixed(1)} words)`, severity: 'medium' })
  if (stats.sentenceVariance < 15 && text.split(' ').length > 40)
    flags.push({ pattern: 'low_variance', description: 'Uniform sentence lengths', severity: 'high' })
  if (stats.uniqueWordRatio < 0.45)
    flags.push({ pattern: 'low_vocabulary', description: 'Low vocabulary diversity', severity: 'medium' })

  const highFlags   = flags.filter(f => f.severity === 'high').length
  const mediumFlags = flags.filter(f => f.severity === 'medium').length
  const lowFlags    = flags.filter(f => f.severity === 'low').length

  // Heuristic AI score
  const heuristicAI = Math.min(1, highFlags * 0.4 + mediumFlags * 0.15 + lowFlags * 0.05)

  // Groq LLM check
  const groqResult = await groqDetect(text)

  // Human marker penalty — reduces AI confidence
  const humanPenalty = humanMarkers.score * 0.5

  // Combined score
  const rawConfidence    = heuristicAI * 0.45 + groqResult.confidence * 0.55
  const finalConfidence  = Math.max(0, Math.min(1, rawConfidence - humanPenalty))

  // Verdict logic
  let verdict: AIDetectionResult['verdict']

  // If strong human markers exist AND no high AI patterns → human
  if (humanMarkers.score >= 0.4 && highFlags === 0) {
    verdict = 'human'
  } else if (groqResult.verdict === 'ai_generated' && groqResult.confidence >= 0.5) {
    verdict = finalConfidence >= 0.6 ? 'ai_generated' : 'mixed'
  } else if (highFlags >= 1 || finalConfidence >= 0.45) {
    verdict = finalConfidence >= 0.6 ? 'ai_generated' : 'mixed'
  } else {
    verdict = 'human'
  }

  // Build human marker info for reasoning
  const humanSignals = [
    humanMarkers.hasEmoji        && 'emoji',
    humanMarkers.hasDash         && 'dashes',
    humanMarkers.hasEllipsis     && 'ellipsis',
    humanMarkers.hasSlang        && 'slang',
    humanMarkers.hasTypo         && 'informal repetition',
    humanMarkers.hasCasualAbbrev && 'casual abbreviations',
  ].filter(Boolean).join(', ')

  const reasoning = groqResult.reasoning
    || `${flags.length} AI pattern(s) detected (${highFlags} high). Human signals: ${humanSignals || 'none'}. Perplexity: ${perplexity}.`

  return {
    verdict,
    confidence:          Math.round(finalConfidence * 1000) / 1000,
    flags,
    perplexity_score:    perplexity,
    avg_sentence_length: Math.round(stats.avgSentenceLength * 10) / 10,
    reasoning,
  }
}