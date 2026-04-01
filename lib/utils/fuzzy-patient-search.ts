/**
 * Fuzzy Patient Search Utility
 *
 * Session 15: Replaces rigid ilike substring matching with fuzzy/phonetic search.
 * Handles STT spelling variations (e.g., "Deepti Tumer" matching "Dipti Tumar").
 *
 * Strategy: Broad candidate fetch via loose ilike, then JS-side ranking with
 * Jaro-Winkler similarity + consonant skeleton matching.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────

export interface PatientMatch {
  id: string
  first_name: string
  last_name: string
  score: number
}

export interface FuzzySearchResult {
  patients: PatientMatch[]
  bestMatch: PatientMatch | null
  confidence: number
}

interface FuzzySearchOptions {
  /** If set, calls supabase.schema(schema).from('patients') */
  schema?: string
  /** Minimum score to be included in results (default: 0.55) */
  minScore?: number
  /** Minimum score for bestMatch to be non-null (default: 0.75) */
  bestMatchThreshold?: number
  /** Max candidates to fetch from DB (default: 20) */
  maxCandidates?: number
}

// ─── Jaro-Winkler Similarity ─────────────────────────────

/**
 * Jaro similarity between two strings (0..1).
 * Good for short strings like names; handles transpositions.
 */
function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0
  if (s1.length === 0 || s2.length === 0) return 0.0

  const matchWindow = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1)
  const s1Matches = new Array(s1.length).fill(false)
  const s2Matches = new Array(s2.length).fill(false)

  let matches = 0
  let transpositions = 0

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, s2.length)

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0.0

  let k = 0
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  return (
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3
  )
}

/**
 * Jaro-Winkler similarity (0..1). Boosts score when strings share a common prefix.
 * Scaling factor p = 0.1 (standard).
 */
function jaroWinkler(s1: string, s2: string): number {
  const jaro = jaroSimilarity(s1, s2)

  // Common prefix length (max 4 characters)
  let prefixLen = 0
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) prefixLen++
    else break
  }

  return jaro + prefixLen * 0.1 * (1 - jaro)
}

// ─── Consonant Skeleton ──────────────────────────────────

/**
 * Extract consonant skeleton from a name.
 * "Dipti" → "DPT", "Deepti" → "DPT", "Deeptee" → "DPT"
 * Indian name romanizations vary in vowels but consonant structure is stable.
 */
function consonantSkeleton(name: string): string {
  return name
    .toUpperCase()
    .replace(/[AEIOU\s\-'\.]/g, '')
    .replace(/(.)\1+/g, '$1') // deduplicate consecutive same letters
}

// ─── Scoring ─────────────────────────────────────────────

/**
 * Score a candidate patient against a search name.
 * Returns 0..1 where higher is better.
 */
function scoreCandidate(
  candidate: { first_name: string; last_name: string },
  searchParts: string[],
  searchFull: string
): number {
  const candidateFull = `${candidate.first_name} ${candidate.last_name}`.toLowerCase()
  const candidateFirst = candidate.first_name.toLowerCase()
  const candidateLast = candidate.last_name.toLowerCase()
  const searchFullLower = searchFull.toLowerCase()

  // Full name Jaro-Winkler
  let score = jaroWinkler(searchFullLower, candidateFull)

  // If search has multiple parts, also compare parts individually
  if (searchParts.length >= 2) {
    const firstScore = jaroWinkler(searchParts[0].toLowerCase(), candidateFirst)
    const lastScore = jaroWinkler(searchParts.slice(1).join(' ').toLowerCase(), candidateLast)
    const partScore = (firstScore + lastScore) / 2
    // Take the better of full-name vs part-by-part comparison
    score = Math.max(score, partScore)
  } else {
    // Single search term — compare against both first and last name
    const firstScore = jaroWinkler(searchParts[0].toLowerCase(), candidateFirst)
    const lastScore = jaroWinkler(searchParts[0].toLowerCase(), candidateLast)
    score = Math.max(score, firstScore, lastScore)
  }

  // Consonant skeleton bonus
  const searchSkeleton = consonantSkeleton(searchFull)
  const candidateSkeleton = consonantSkeleton(candidateFull)
  if (searchSkeleton.length >= 2 && candidateSkeleton.includes(searchSkeleton)) {
    score += 0.10
  } else if (searchParts.length >= 2) {
    // Check part skeletons
    const firstSkel = consonantSkeleton(searchParts[0])
    const lastSkel = consonantSkeleton(searchParts.slice(1).join(' '))
    const candFirstSkel = consonantSkeleton(candidate.first_name)
    const candLastSkel = consonantSkeleton(candidate.last_name)
    if (firstSkel.length >= 2 && candFirstSkel === firstSkel) score += 0.05
    if (lastSkel.length >= 2 && candLastSkel === lastSkel) score += 0.05
  }

  // First letter match bonus
  if (searchParts.length >= 1 && candidateFirst[0] === searchParts[0][0]?.toLowerCase()) {
    score += 0.05
  }

  return Math.min(score, 1.0)
}

// ─── Main Search Function ────────────────────────────────

/**
 * Fuzzy search patients by name with ranking.
 *
 * 1. Broad candidate fetch: loose 2-char prefix ilike on first_name/last_name
 * 2. JS-side ranking: Jaro-Winkler + consonant skeleton + first-letter bonus
 * 3. Return ranked results with confidence scores
 *
 * @param supabase - Supabase client (should be createServiceClient to avoid cookies deadlock)
 * @param searchName - The name to search for (from STT or text input)
 * @param options - Schema, thresholds, limits
 */
export async function fuzzySearchPatients(
  supabase: SupabaseClient,
  searchName: string,
  options: FuzzySearchOptions = {}
): Promise<FuzzySearchResult> {
  const {
    schema,
    minScore = 0.55,
    bestMatchThreshold = 0.75,
    maxCandidates = 20,
  } = options

  const emptyResult: FuzzySearchResult = { patients: [], bestMatch: null, confidence: 0 }

  if (!searchName || searchName.trim().length === 0) {
    return emptyResult
  }

  const nameParts = searchName.trim().split(/\s+/)

  // Build broad candidate query using loose 2-char prefix matching
  const query = schema
    ? supabase.schema(schema).from('patients').select('id, first_name, last_name')
    : supabase.from('patients').select('id, first_name, last_name')

  // Build OR conditions for loose matching
  const orConditions: string[] = []
  for (const part of nameParts) {
    if (part.length >= 2) {
      const prefix = part.substring(0, 2)
      orConditions.push(`first_name.ilike.%${prefix}%`)
      orConditions.push(`last_name.ilike.%${prefix}%`)
    } else if (part.length === 1) {
      orConditions.push(`first_name.ilike.${part}%`)
      orConditions.push(`last_name.ilike.${part}%`)
    }
  }

  // Also add full substring match as a condition (catches exact matches)
  for (const part of nameParts) {
    if (part.length >= 3) {
      orConditions.push(`first_name.ilike.%${part}%`)
      orConditions.push(`last_name.ilike.%${part}%`)
    }
  }

  if (orConditions.length === 0) {
    return emptyResult
  }

  // Deduplicate conditions
  const uniqueConditions = [...new Set(orConditions)]

  const { data: candidates, error } = await query
    .or(uniqueConditions.join(','))
    .limit(maxCandidates)

  if (error) {
    console.error('❌ [FUZZY SEARCH] Database error:', error.message)
    throw error
  }

  if (!candidates || candidates.length === 0) {
    console.log(`🔍 [FUZZY SEARCH] No candidates found for "${searchName}"`)
    return emptyResult
  }

  console.log(`🔍 [FUZZY SEARCH] Found ${candidates.length} candidates for "${searchName}"`)

  // Score and rank candidates
  const scored: PatientMatch[] = candidates
    .map((c: any) => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      score: scoreCandidate(c, nameParts, searchName),
    }))
    .filter((m: PatientMatch) => m.score >= minScore)
    .sort((a: PatientMatch, b: PatientMatch) => b.score - a.score)

  if (scored.length > 0) {
    console.log(`✅ [FUZZY SEARCH] Top matches:`, scored.slice(0, 3).map(
      m => `${m.first_name} ${m.last_name} (${(m.score * 100).toFixed(1)}%)`
    ))
  }

  const bestMatch = scored.length > 0 && scored[0].score >= bestMatchThreshold
    ? scored[0]
    : null

  return {
    patients: scored.slice(0, 5), // Return top 5
    bestMatch,
    confidence: scored.length > 0 ? scored[0].score : 0,
  }
}
