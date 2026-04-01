/**
 * Dental vocabulary for Deepgram keyword boosting
 * Weight scale: 1 (slight boost) to 5 (strong boost)
 * Higher weight = more likely Deepgram recognizes the term correctly
 */

// Session 15: Wake word + app name — highest priority so Deepgram recognizes them
const WAKE_WORDS: [string, number][] = [
  ['EndoFlow', 5], ['Endo Flow', 5], ['Hey EndoFlow', 5],
  ['endoflow', 5], ['endo flow', 5],
]

// Endodontic terms
const ENDODONTIC: [string, number][] = [
  ['pulpitis', 3], ['pulpotomy', 3], ['pulpectomy', 3],
  ['apicoectomy', 3], ['endodontic', 2], ['root canal', 3],
  ['obturation', 3], ['biomechanical preparation', 2],
  ['working length', 2], ['apex locator', 2], ['apical', 2],
  ['periapical', 2], ['pulp capping', 2], ['vital pulp therapy', 2],
  ['irreversible pulpitis', 3], ['reversible pulpitis', 3],
  ['necrotic pulp', 2], ['apical periodontitis', 2],
  ['retreatment', 2], ['perforation', 2], ['resorption', 2],
  ['calcification', 2], ['obliteration', 2],
]

// Materials
const MATERIALS: [string, number][] = [
  ['MTA', 4], ['biodentine', 3], ['gutta percha', 3],
  ['sodium hypochlorite', 2], ['EDTA', 4], ['calcium hydroxide', 2],
  ['composite', 2], ['GIC', 3], ['glass ionomer', 2],
  ['zinc oxide eugenol', 2], ['resin', 2], ['ceramic', 2],
  ['zirconia', 2], ['lithium disilicate', 2],
  ['mineral trioxide aggregate', 2], ['bioceramic', 2],
  ['AH Plus', 3], ['Protaper', 3], ['WaveOne', 3],
  ['Reciproc', 3], ['chlorhexidine', 2],
]

// Anatomy & tooth types
const ANATOMY: [string, number][] = [
  ['mandibular', 2], ['maxillary', 2], ['molar', 2],
  ['premolar', 2], ['incisor', 2], ['canine', 2],
  ['distal', 2], ['mesial', 2], ['buccal', 2],
  ['lingual', 2], ['palatal', 2], ['occlusal', 2],
  ['cervical', 2], ['furcation', 2], ['bifurcation', 2],
  ['trifurcation', 2], ['mesio-buccal', 2], ['disto-buccal', 2],
  ['MB2', 3], ['isthmus', 2],
]

// Imaging & diagnostics
const IMAGING: [string, number][] = [
  ['IOPA', 4], ['OPG', 4], ['CBCT', 4],
  ['periapical radiograph', 2], ['panoramic', 2],
  ['electric pulp test', 2], ['cold test', 2],
  ['vitality test', 2], ['thermal test', 2],
  ['percussion test', 2], ['palpation', 2],
  ['transillumination', 2],
]

// Periodontal terms
const PERIODONTAL: [string, number][] = [
  ['periodontal', 2], ['periodontitis', 2], ['gingivitis', 2],
  ['scaling', 2], ['root planing', 2], ['probing depth', 2],
  ['clinical attachment level', 2], ['bone loss', 2],
  ['flap surgery', 2], ['guided tissue regeneration', 2],
  ['GTR', 3], ['bone graft', 2], ['membrane', 2],
]

// General procedures
const PROCEDURES: [string, number][] = [
  ['extraction', 2], ['impaction', 2], ['crown', 2],
  ['bridge', 2], ['veneer', 2], ['implant', 2],
  ['denture', 2], ['prosthesis', 2], ['abutment', 2],
  ['impression', 2], ['cementation', 2], ['debonding', 2],
  ['temporization', 2], ['occlusal adjustment', 2],
  ['splinting', 2], ['frenectomy', 2],
]

// Restorative terms (Session 7)
const RESTORATIVE: [string, number][] = [
  ['MOD', 4], ['mesio-occlusal', 3], ['disto-occlusal', 3],
  ['mesio-occlusal-distal', 3], ['occlusal', 3],
  ['composite restoration', 2], ['amalgam restoration', 2],
  ['direct restoration', 2], ['indirect restoration', 2],
  ['inlay', 3], ['onlay', 3], ['overlay', 3], ['endocrown', 3],
  ['post and core', 3], ['ferrule', 3], ['ferrule effect', 2],
  ['cuspal coverage', 2], ['undermined cusp', 2],
  ['deep caries', 3], ['superficial caries', 2], ['recurrent caries', 2],
  ['caries removal', 2], ['caries excavation', 2],
  ['emax', 3], ['e-max', 3], ['PFM', 3], ['porcelain fused to metal', 2],
  ['rubber dam', 3], ['isolation', 2], ['tooth structure', 2],
  ['remaining walls', 2], ['proximal contact', 2],
  ['esthetic zone', 2], ['shade matching', 2],
  ['Class I', 2], ['Class II', 2], ['Class III', 2], ['Class IV', 2], ['Class V', 2],
  ['Black classification', 2],
]

// Clinical abbreviations
const ABBREVIATIONS: [string, number][] = [
  ['RCT', 4], ['VPT', 4], ['DPC', 4], ['IPC', 4],
  ['BMP', 3], ['WL', 3], ['MAF', 3], ['IAF', 3],
  ['PDL', 3], ['CEJ', 3], ['CAL', 3], ['BOP', 3],
  ['FDI', 3], ['WHO', 2], ['ADA', 2], ['AAE', 3],
]

// FDI tooth numbers — boost recognition of "tooth 11" through "tooth 48"
const FDI_TEETH: [string, number][] = []
for (const quadrant of [1, 2, 3, 4]) {
  for (const tooth of [1, 2, 3, 4, 5, 6, 7, 8]) {
    FDI_TEETH.push([`tooth ${quadrant}${tooth}`, 2])
    FDI_TEETH.push([`${quadrant}${tooth}`, 2])
    // Also add with dot notation: "3.6" = tooth 36
    FDI_TEETH.push([`${quadrant}.${tooth}`, 2])
  }
}

// All vocabulary combined
const ALL_VOCABULARY: [string, number][] = [
  ...WAKE_WORDS,
  ...ENDODONTIC,
  ...MATERIALS,
  ...ANATOMY,
  ...IMAGING,
  ...PERIODONTAL,
  ...PROCEDURES,
  ...RESTORATIVE,
  ...ABBREVIATIONS,
  ...FDI_TEETH,
]

/**
 * Get formatted keywords string for Deepgram Nova-2 API (keyword boosting)
 * Format: "keyword:weight" joined by commas
 * Deepgram supports up to ~100 keywords
 *
 * Session 14: Reduced boost weights from 3-4 to 1-2 to prevent over-correction
 * of general speech. Only abbreviations keep higher boost (they're unambiguous).
 */
export function getDeepgramKeywords(mode: 'clinical' | 'general' = 'general'): string {
  if (mode === 'general') {
    // Session 20: ALWAYS include wake words in general mode — they were previously missing,
    // causing Deepgram to never recognize "EndoFlow" during sidebar listening.
    const wakeWordsFormatted = WAKE_WORDS.map(([term, weight]) => `${term}:${weight}`)
    const abbreviationsOnly = [...ABBREVIATIONS, ...IMAGING.filter(([t]) => t.length <= 4)]
    const abbrevFormatted = abbreviationsOnly.slice(0, 25).map(([term, weight]) => `${term}:${Math.min(weight, 2)}`)
    return [...wakeWordsFormatted, ...abbrevFormatted].join(',')
  }

  // In clinical mode, use full vocabulary — keep wake words at full weight
  const sorted = [...ALL_VOCABULARY].sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 100)
  return top.map(([term, weight]) => {
    // Session 20: Keep wake words at full boost even in clinical mode
    const isWakeWord = WAKE_WORDS.some(([ww]) => ww.toLowerCase() === term.toLowerCase())
    return `${term}:${isWakeWord ? weight : Math.max(1, weight - 1)}`
  }).join(',')
}

/**
 * Get keyterms for Deepgram Nova-3 API (keyterm prompting)
 * Nova-3 uses contextual understanding, not raw boost — pass terms as strings.
 * This is the preferred approach for Nova-3 medical model.
 */
export function getDeepgramKeyterms(): string[] {
  // All dental terms without weights — Nova-3 handles context automatically
  return ALL_VOCABULARY.map(([term]) => term)
}

/**
 * Get keywords as an array of objects (for SDK usage)
 */
export function getDeepgramKeywordsArray(): Array<{ keyword: string; boost: number }> {
  const sorted = [...ALL_VOCABULARY].sort((a, b) => b[1] - a[1])
  return sorted.slice(0, 100).map(([keyword, boost]) => ({ keyword, boost }))
}

/**
 * Session 14: Determine which Deepgram model to use based on context.
 * - General speech (nav, tasks, chat): nova-2 (fast, general purpose)
 * - Clinical mode with active consultation: nova-2-medical (or nova-3-medical when available)
 */
export function selectDeepgramModel(isClinicalMode: boolean): {
  model: string
  keywordMode: 'keywords' | 'keyterms'
} {
  if (isClinicalMode) {
    return { model: 'nova-2-medical', keywordMode: 'keywords' }
    // Future: switch to nova-3-medical with keyterms when API is available
    // return { model: 'nova-3-medical', keywordMode: 'keyterms' }
  }
  return { model: 'nova-2', keywordMode: 'keywords' }
}

export { ALL_VOCABULARY, WAKE_WORDS, ENDODONTIC, MATERIALS, ANATOMY, IMAGING, PERIODONTAL, PROCEDURES, RESTORATIVE, ABBREVIATIONS }
