/**
 * Document Processor Service
 * Handles subspecialty auto-classification and section-aware chunking
 * for the medical knowledge base.
 *
 * Phase 1 of Session 6: Knowledge Base Enhancement
 */

import { aiChatCompletion } from './ai-provider'
import { generateEmbedding3072, generateBatchEmbeddings3072 } from './openai-embeddings'

// =====================================================
// SUBSPECIALTY CLASSIFICATION
// =====================================================

export const SUBSPECIALTY_TAGS = [
  'pulp_pathology',
  'periapical_pathology',
  'trauma',
  'resorption',
  'endo_perio',
  'cracked_tooth',
  'regenerative_endo',
  'retreatment',
  'surgical_endo',
  'vital_pulp_therapy',
  'bleaching',
  'restorative',
  'periodontal',
  'prosthodontic',
  'pediatric_endo',
] as const

export type SubspecialtyTag = typeof SUBSPECIALTY_TAGS[number]

export interface ClassificationResult {
  tags: SubspecialtyTag[]
  confidence: number
  reasoning: string
}

/**
 * Auto-classify a document's subspecialty using AI.
 * Uses a single LLM call with structured JSON output.
 */
export async function classifySubspecialty(params: {
  title: string
  content: string
  existingTopics?: string[]
  existingDiagnosisKeywords?: string[]
}): Promise<ClassificationResult> {
  const { title, content, existingTopics, existingDiagnosisKeywords } = params

  // Use first 4000 chars of content to stay within token budget
  const truncatedContent = content.substring(0, 4000)

  const systemInstruction = `You are a dental subspecialty classifier. Given a medical document's title and content, assign subspecialty tags from this EXACT list:

${SUBSPECIALTY_TAGS.join(', ')}

Rules:
- Assign 1-4 tags that best describe the document's clinical focus
- Use ONLY tags from the list above
- Return valid JSON only

Return format:
{
  "tags": ["tag1", "tag2"],
  "confidence": 0.85,
  "reasoning": "Brief explanation"
}`

  const userPrompt = `Title: ${title}

Content excerpt:
${truncatedContent}

${existingTopics?.length ? `Existing topics: ${existingTopics.join(', ')}` : ''}
${existingDiagnosisKeywords?.length ? `Diagnosis keywords: ${existingDiagnosisKeywords.join(', ')}` : ''}

Classify this document's subspecialty tags.`

  try {
    const response = await aiChatCompletion(
      [{ role: 'user', parts: [{ text: userPrompt }] }],
      {
        task: 'classification',
        provider: 'gemini', // Fast task, Gemini is fine
        temperature: 0.1,
        responseFormat: 'json',
        systemInstruction,
      }
    )

    const parsed = JSON.parse(response || '{}')

    // Validate tags against known list
    const validTags = (parsed.tags || []).filter(
      (t: string) => SUBSPECIALTY_TAGS.includes(t as SubspecialtyTag)
    ) as SubspecialtyTag[]

    // Fallback: if AI returned no valid tags, use heuristic
    if (validTags.length === 0) {
      return heuristicClassify(title, content)
    }

    return {
      tags: validTags,
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || 'AI classification',
    }
  } catch (error) {
    console.warn('⚠️ [DOC PROCESSOR] AI classification failed, using heuristic:', error)
    return heuristicClassify(title, content)
  }
}

/**
 * Heuristic fallback for subspecialty classification when AI is unavailable
 */
function heuristicClassify(title: string, content: string): ClassificationResult {
  const text = `${title} ${content}`.toLowerCase()
  const tags: SubspecialtyTag[] = []

  const patterns: [RegExp, SubspecialtyTag][] = [
    [/pulp\s*(itis|al|otomy|ectomy)|vital\s*pulp|pulp\s*(diagnosis|test|status)/i, 'pulp_pathology'],
    [/periapical|apical\s*(periodontitis|abscess|lesion|radiolucency)|peri-radicular/i, 'periapical_pathology'],
    [/trauma|avulsion|luxation|intrusion|extrusion|fractur(e|ed)\s*(crown|root)|dento-?alveolar/i, 'trauma'],
    [/resorption|internal\s*resorption|external\s*resorption|cervical\s*resorption|root\s*resorption/i, 'resorption'],
    [/endo[\s-]?perio|combined\s*lesion|periodontal[\s-]?endodontic/i, 'endo_perio'],
    [/crack(ed)?\s*tooth|craze\s*line|split\s*tooth|vertical\s*root\s*fracture/i, 'cracked_tooth'],
    [/regener(ative|ation)|revasculariz|scaffold|stem\s*cell|apexification|MTA\s*apical/i, 'regenerative_endo'],
    [/re[\s-]?treat(ment)?|revision|failed\s*(rct|root\s*canal)|persistent\s*(infection|lesion)/i, 'retreatment'],
    [/surgical\s*(endo|approach)|apicoectomy|apicectomy|retrograde|root[\s-]?end|hemisection/i, 'surgical_endo'],
    [/vital\s*pulp\s*therapy|direct\s*(pulp\s*cap|capping)|indirect\s*(pulp\s*cap|capping)|stepwise|VPT/i, 'vital_pulp_therapy'],
    [/bleach(ing)?|whitening|discolou?r(ation|ed)|walking\s*bleach|intracoronal/i, 'bleaching'],
    [/restor(ation|ative)|composite|amalgam|inlay|onlay|post[\s-]?(and[\s-]?)?core/i, 'restorative'],
    [/periodon(tal|tics)|gingiv|pocket|scaling|root\s*plan(ing|ning)|perio\s*(surgery|treatment)/i, 'periodontal'],
    [/prostho(dontic|ntics)|crown|bridge|implant|denture|veneer|fixed\s*prosth/i, 'prosthodontic'],
    [/pediat(ric|rics)\s*(endo|dentist)|primary\s*(tooth|teeth|molar)|pulp(otomy|ectomy)\s*(primary|deciduous)/i, 'pediatric_endo'],
  ]

  for (const [pattern, tag] of patterns) {
    if (pattern.test(text)) {
      tags.push(tag)
    }
  }

  // Default to pulp_pathology if nothing matched (most common in endodontics)
  if (tags.length === 0) {
    tags.push('pulp_pathology')
  }

  return {
    tags: tags.slice(0, 4),
    confidence: 0.4,
    reasoning: 'Heuristic keyword-based classification (AI unavailable)',
  }
}

// =====================================================
// SECTION-AWARE DOCUMENT CHUNKING
// =====================================================

export interface DocumentChunk {
  sectionTitle: string
  content: string
  chunkIndex: number
  tokenEstimate: number
}

/**
 * Chunk a document by sections (headings) with overlap.
 *
 * Strategy:
 * - Split by markdown headings (##, ###) or detected section breaks
 * - Target: 500-1500 tokens per chunk (sweet spot for RAG)
 * - 100-token overlap between adjacent chunks for context continuity
 * - Each chunk inherits parent document metadata
 */
export function chunkDocument(params: {
  title: string
  content: string
  targetMinTokens?: number
  targetMaxTokens?: number
  overlapTokens?: number
}): DocumentChunk[] {
  const {
    content,
    title,
    targetMinTokens = 500,
    targetMaxTokens = 1500,
    overlapTokens = 100,
  } = params

  // Estimate tokens (rough: 1 token ≈ 4 chars for English)
  const estimateTokens = (text: string) => Math.ceil(text.length / 4)
  const estimateChars = (tokens: number) => tokens * 4

  const totalTokens = estimateTokens(content)

  // If document is small enough, return as single chunk
  if (totalTokens <= targetMaxTokens) {
    return [
      {
        sectionTitle: title,
        content: content.trim(),
        chunkIndex: 0,
        tokenEstimate: totalTokens,
      },
    ]
  }

  // Step 1: Split by section headings
  const sections = splitBySections(content)

  // Step 2: Merge small sections, split large ones
  const chunks: DocumentChunk[] = []
  let currentChunk = ''
  let currentTitle = title
  let chunkIndex = 0

  for (const section of sections) {
    const sectionTokens = estimateTokens(section.content)
    const currentTokens = estimateTokens(currentChunk)

    // If section itself is too large, split it by paragraphs
    if (sectionTokens > targetMaxTokens) {
      // Flush current chunk first
      if (currentChunk.trim()) {
        chunks.push({
          sectionTitle: currentTitle,
          content: currentChunk.trim(),
          chunkIndex: chunkIndex++,
          tokenEstimate: estimateTokens(currentChunk),
        })
        currentChunk = ''
      }

      // Split large section into sub-chunks
      const subChunks = splitBySize(
        section.content,
        estimateChars(targetMaxTokens),
        estimateChars(overlapTokens)
      )
      for (const sub of subChunks) {
        chunks.push({
          sectionTitle: section.title || currentTitle,
          content: sub.trim(),
          chunkIndex: chunkIndex++,
          tokenEstimate: estimateTokens(sub),
        })
      }
      currentTitle = section.title || title
      continue
    }

    // If adding this section exceeds max, flush current chunk
    if (currentTokens + sectionTokens > targetMaxTokens && currentChunk.trim()) {
      chunks.push({
        sectionTitle: currentTitle,
        content: currentChunk.trim(),
        chunkIndex: chunkIndex++,
        tokenEstimate: currentTokens,
      })

      // Start new chunk with overlap from end of previous
      const overlapChars = estimateChars(overlapTokens)
      const overlapText = currentChunk.slice(-overlapChars)
      currentChunk = overlapText
      currentTitle = section.title || currentTitle
    }

    // Accumulate section into current chunk
    if (section.title) {
      currentTitle = section.title
    }
    currentChunk += (currentChunk ? '\n\n' : '') + section.content
  }

  // Flush remaining content
  if (currentChunk.trim()) {
    const tokens = estimateTokens(currentChunk)
    // If remainder is too small, merge with last chunk
    if (tokens < targetMinTokens && chunks.length > 0) {
      const lastChunk = chunks[chunks.length - 1]
      lastChunk.content += '\n\n' + currentChunk.trim()
      lastChunk.tokenEstimate = estimateTokens(lastChunk.content)
    } else {
      chunks.push({
        sectionTitle: currentTitle,
        content: currentChunk.trim(),
        chunkIndex: chunkIndex++,
        tokenEstimate: tokens,
      })
    }
  }

  return chunks
}

/**
 * Split content by markdown headings or IMRAD-style section breaks
 */
function splitBySections(content: string): { title: string; content: string }[] {
  // Match markdown headings (##, ###, ####) or ALL-CAPS section headers
  const sectionRegex = /(?:^|\n)(#{1,4}\s+.+|[A-Z][A-Z\s]{3,}(?:\n|$))/g
  const sections: { title: string; content: string }[] = []

  let lastIndex = 0
  let lastTitle = ''
  let match: RegExpExecArray | null

  // Reset regex
  sectionRegex.lastIndex = 0

  while ((match = sectionRegex.exec(content)) !== null) {
    // Content before this heading
    if (match.index > lastIndex) {
      const sectionContent = content.slice(lastIndex, match.index).trim()
      if (sectionContent) {
        sections.push({ title: lastTitle, content: sectionContent })
      }
    }

    // Extract heading text (strip # characters)
    lastTitle = match[1].replace(/^#+\s*/, '').trim()
    lastIndex = match.index + match[0].length
  }

  // Remaining content after last heading
  const remaining = content.slice(lastIndex).trim()
  if (remaining) {
    sections.push({ title: lastTitle, content: remaining })
  }

  // If no sections found, return entire content as one section
  if (sections.length === 0) {
    sections.push({ title: '', content: content.trim() })
  }

  return sections
}

/**
 * Split text by character count with overlap (paragraph-aware)
 */
function splitBySize(
  text: string,
  maxChars: number,
  overlapChars: number
): string[] {
  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if (current.length + para.length > maxChars && current.trim()) {
      chunks.push(current.trim())
      // Start next chunk with overlap from end of current
      const overlap = current.slice(-overlapChars)
      current = overlap + '\n\n' + para
    } else {
      current += (current ? '\n\n' : '') + para
    }
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks
}

// =====================================================
// COMBINED: PROCESS DOCUMENT FOR UPLOAD
// =====================================================

export interface ProcessedDocument {
  parentEntry: {
    title: string
    content: string
    subspecialtyTags: SubspecialtyTag[]
    classificationConfidence: number
  }
  chunks: {
    sectionTitle: string
    content: string
    chunkIndex: number
    embeddingText: string
    embedding: number[]
    subspecialtyTags: SubspecialtyTag[]
  }[]
}

/**
 * Full document processing pipeline:
 * 1. Classify subspecialty
 * 2. Chunk into sections
 * 3. Generate 3072-dim embeddings for each chunk
 */
export async function processDocumentForUpload(params: {
  title: string
  content: string
  existingTopics?: string[]
  existingDiagnosisKeywords?: string[]
}): Promise<ProcessedDocument> {
  const { title, content, existingTopics, existingDiagnosisKeywords } = params

  console.log(`📄 [DOC PROCESSOR] Processing: "${title}" (${content.length} chars)`)

  // Step 1: Classify subspecialty
  console.log('🏷️ [DOC PROCESSOR] Classifying subspecialty...')
  const classification = await classifySubspecialty({
    title,
    content,
    existingTopics,
    existingDiagnosisKeywords,
  })
  console.log(`✅ [DOC PROCESSOR] Tags: ${classification.tags.join(', ')} (${(classification.confidence * 100).toFixed(0)}%)`)

  // Step 2: Chunk document
  console.log('✂️ [DOC PROCESSOR] Chunking document...')
  const rawChunks = chunkDocument({ title, content })
  console.log(`✅ [DOC PROCESSOR] ${rawChunks.length} chunks created`)

  // Step 3: Generate embeddings for all chunks in batch
  console.log(`🔮 [DOC PROCESSOR] Generating ${rawChunks.length} OpenAI 3072-dim embeddings...`)
  const embeddingTexts = rawChunks.map(
    (c) => `${c.sectionTitle ? c.sectionTitle + '\n\n' : ''}${c.content}`
  )
  const embeddings = await generateBatchEmbeddings3072(embeddingTexts)
  console.log('✅ [DOC PROCESSOR] All embeddings generated')

  return {
    parentEntry: {
      title,
      content,
      subspecialtyTags: classification.tags,
      classificationConfidence: classification.confidence,
    },
    chunks: rawChunks.map((chunk, i) => ({
      sectionTitle: chunk.sectionTitle,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      embeddingText: embeddingTexts[i],
      embedding: embeddings[i],
      subspecialtyTags: classification.tags,
    })),
  }
}
