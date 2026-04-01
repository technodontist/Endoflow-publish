/**
 * Re-embedding Migration Script
 *
 * Processes all existing medical_knowledge documents:
 * 1. Generates 3072-dim OpenAI embeddings (replacing 768-dim Gemini)
 * 2. Auto-classifies subspecialty tags
 * 3. Chunks large documents into section-aware pieces
 *
 * Usage:
 *   npx tsx scripts/reembed-existing-documents.ts
 *
 * Required env vars: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: GEMINI_API_KEY (for subspecialty classification via AI)
 */

import { createClient } from '@supabase/supabase-js'

// Direct Supabase client (no Next.js server context)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})

// ---- Inline OpenAI embedding (avoid Next.js imports) ----

import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function embed3072(text: string): Promise<number[]> {
  const truncated = text.length > 30000 ? text.substring(0, 30000) : text
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: truncated,
    dimensions: 3072,
  })
  return response.data[0].embedding
}

async function batchEmbed3072(texts: string[]): Promise<number[][]> {
  const truncated = texts.map(t => t.length > 30000 ? t.substring(0, 30000) : t)
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: truncated,
    dimensions: 3072,
  })
  return response.data.sort((a, b) => a.index - b.index).map(d => d.embedding)
}

// ---- Inline subspecialty classification (heuristic only — no AI dependency) ----

const SUBSPECIALTY_PATTERNS: [RegExp, string][] = [
  [/pulp\s*(itis|al|otomy|ectomy)|vital\s*pulp|pulp\s*(diagnosis|test|status)/i, 'pulp_pathology'],
  [/periapical|apical\s*(periodontitis|abscess|lesion|radiolucency)|peri-radicular/i, 'periapical_pathology'],
  [/trauma|avulsion|luxation|intrusion|extrusion|fractur(e|ed)\s*(crown|root)|dento-?alveolar/i, 'trauma'],
  [/resorption|internal\s*resorption|external\s*resorption|cervical\s*resorption/i, 'resorption'],
  [/endo[\s-]?perio|combined\s*lesion|periodontal[\s-]?endodontic/i, 'endo_perio'],
  [/crack(ed)?\s*tooth|craze\s*line|split\s*tooth|vertical\s*root\s*fracture/i, 'cracked_tooth'],
  [/regener(ative|ation)|revasculariz|scaffold|stem\s*cell|apexification/i, 'regenerative_endo'],
  [/re[\s-]?treat(ment)?|revision|failed\s*(rct|root\s*canal)|persistent\s*(infection|lesion)/i, 'retreatment'],
  [/surgical\s*(endo|approach)|apicoectomy|apicectomy|retrograde|root[\s-]?end|hemisection/i, 'surgical_endo'],
  [/vital\s*pulp\s*therapy|direct\s*(pulp\s*cap|capping)|indirect\s*(pulp\s*cap|capping)|VPT/i, 'vital_pulp_therapy'],
  [/bleach(ing)?|whitening|discolou?r(ation|ed)|walking\s*bleach/i, 'bleaching'],
  [/restor(ation|ative)|composite|amalgam|inlay|onlay|post[\s-]?(and[\s-]?)?core/i, 'restorative'],
  [/periodon(tal|tics)|gingiv|pocket|scaling|root\s*plan(ing|ning)/i, 'periodontal'],
  [/prostho(dontic|ntics)|crown|bridge|implant|denture|veneer/i, 'prosthodontic'],
  [/pediat(ric|rics)\s*(endo|dentist)|primary\s*(tooth|teeth|molar)/i, 'pediatric_endo'],
]

function classifyHeuristic(title: string, content: string): string[] {
  const text = `${title} ${content.substring(0, 4000)}`.toLowerCase()
  const tags: string[] = []
  for (const [pattern, tag] of SUBSPECIALTY_PATTERNS) {
    if (pattern.test(text)) tags.push(tag)
  }
  return tags.length > 0 ? tags.slice(0, 4) : ['pulp_pathology']
}

// ---- Simple chunking (paragraph-based) ----

interface Chunk {
  sectionTitle: string
  content: string
  chunkIndex: number
}

function chunkContent(title: string, content: string): Chunk[] {
  const maxChars = 6000 // ~1500 tokens
  const overlapChars = 400 // ~100 tokens

  if (content.length <= maxChars) {
    return [{ sectionTitle: title, content, chunkIndex: 0 }]
  }

  // Split by headings or double newlines
  const sections = content.split(/(?=#{1,4}\s+)|(?:\n\n(?=[A-Z]))/g).filter(Boolean)
  const chunks: Chunk[] = []
  let current = ''
  let currentTitle = title
  let idx = 0

  for (const section of sections) {
    const headingMatch = section.match(/^#{1,4}\s+(.+)/)
    if (headingMatch) currentTitle = headingMatch[1].trim()

    if (current.length + section.length > maxChars && current.trim()) {
      chunks.push({ sectionTitle: currentTitle, content: current.trim(), chunkIndex: idx++ })
      current = current.slice(-overlapChars)
    }
    current += section
  }

  if (current.trim()) {
    chunks.push({ sectionTitle: currentTitle, content: current.trim(), chunkIndex: idx++ })
  }

  return chunks
}

// ---- Main migration ----

async function main() {
  console.log('=== Re-embedding Migration Script ===\n')

  // Fetch all existing documents that don't have 3072-dim embeddings yet
  // and are not already chunks (parent_document_id IS NULL or chunk_index = -1 or 0)
  const { data: docs, error: fetchError } = await supabase
    .from('medical_knowledge')
    .select('id, title, content, source_type, specialty, authors, publication_year, journal, doi, url, isbn, topics, diagnosis_keywords, treatment_keywords, uploaded_by, metadata, parent_document_id, chunk_index')
    .is('parent_document_id', null)
    .is('embedding_3072', null)
    .order('created_at', { ascending: true })

  if (fetchError) {
    console.error('Failed to fetch documents:', fetchError)
    process.exit(1)
  }

  if (!docs || docs.length === 0) {
    console.log('No documents need re-embedding. All done!')
    return
  }

  console.log(`Found ${docs.length} documents to process\n`)

  let processed = 0
  let chunksCreated = 0

  for (const doc of docs) {
    console.log(`\n[${processed + 1}/${docs.length}] Processing: "${doc.title}"`)

    // Step 1: Classify subspecialty
    const tags = classifyHeuristic(doc.title, doc.content)
    console.log(`  Tags: ${tags.join(', ')}`)

    // Step 2: Update parent document with tags and mark as parent (chunk_index = -1)
    await supabase
      .from('medical_knowledge')
      .update({
        subspecialty_tags: tags,
        chunk_index: -1,
      })
      .eq('id', doc.id)

    // Step 3: Chunk the document
    const chunks = chunkContent(doc.title, doc.content)
    console.log(`  Chunks: ${chunks.length}`)

    // Step 4: Generate embeddings for all chunks
    const embeddingTexts = chunks.map(c =>
      `${c.sectionTitle ? c.sectionTitle + '\n\n' : ''}${c.content}`
    )
    const embeddings = await batchEmbed3072(embeddingTexts)
    console.log(`  Embeddings: ${embeddings.length} x 3072-dim`)

    // Step 5: Insert chunk rows
    const chunkRows = chunks.map((chunk, i) => ({
      title: `${doc.title} — ${chunk.sectionTitle || `Chunk ${chunk.chunkIndex + 1}`}`,
      content: chunk.content,
      source_type: doc.source_type,
      specialty: doc.specialty,
      authors: doc.authors,
      publication_year: doc.publication_year,
      journal: doc.journal,
      doi: doc.doi,
      url: doc.url,
      isbn: doc.isbn,
      topics: doc.topics,
      diagnosis_keywords: doc.diagnosis_keywords,
      treatment_keywords: doc.treatment_keywords,
      subspecialty_tags: tags,
      embedding_3072: embeddings[i],
      parent_document_id: doc.id,
      chunk_index: chunk.chunkIndex,
      section_title: chunk.sectionTitle,
      uploaded_by: doc.uploaded_by,
    }))

    const { error: insertError } = await supabase
      .from('medical_knowledge')
      .insert(chunkRows)

    if (insertError) {
      console.error(`  ERROR inserting chunks: ${insertError.message}`)
    } else {
      chunksCreated += chunks.length
      console.log(`  OK`)
    }

    processed++

    // Rate limit: small delay between documents
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\n=== Migration Complete ===`)
  console.log(`Documents processed: ${processed}`)
  console.log(`Chunks created: ${chunksCreated}`)
}

main().catch(console.error)
