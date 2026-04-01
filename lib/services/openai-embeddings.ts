/**
 * OpenAI Embedding Service
 * Uses text-embedding-3-large (3072 dimensions) for high-quality medical document retrieval.
 *
 * Based on JADE RAG study (PMID 41872013) which demonstrated superior retrieval
 * accuracy with text-embedding-3-large vs lower-dimensional alternatives.
 */

import OpenAI from 'openai'

const MODEL = 'text-embedding-3-large'
const DIMENSIONS = 3072

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not configured')
    }
    client = new OpenAI({ apiKey })
  }
  return client
}

/**
 * Generate a single embedding using OpenAI text-embedding-3-large
 * @param text - Text to embed (max ~8191 tokens)
 * @param taskType - Unused here but kept for API compatibility with Gemini service
 * @returns 3072-dimensional normalized embedding vector
 */
export async function generateEmbedding3072(
  text: string,
  taskType?: string
): Promise<number[]> {
  try {
    const openai = getClient()

    // Truncate to safe limit (~30k chars ≈ 8k tokens)
    const truncated = text.length > 30000 ? text.substring(0, 30000) : text

    const response = await openai.embeddings.create({
      model: MODEL,
      input: truncated,
      dimensions: DIMENSIONS,
    })

    const embedding = response.data[0].embedding

    if (embedding.length !== DIMENSIONS) {
      console.warn(`⚠️ [OPENAI EMB] Expected ${DIMENSIONS} dims, got ${embedding.length}`)
    }

    return embedding
  } catch (error) {
    console.error('❌ [OPENAI EMB] Embedding generation failed:', error)
    throw new Error(
      `Failed to generate OpenAI embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Generate batch embeddings for multiple texts
 * OpenAI supports batching natively — more efficient than individual calls
 * @param texts - Array of texts to embed
 * @returns Array of 3072-dimensional embedding vectors
 */
export async function generateBatchEmbeddings3072(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return []

  try {
    const openai = getClient()

    // Truncate each text
    const truncated = texts.map(t => t.length > 30000 ? t.substring(0, 30000) : t)

    // OpenAI allows up to 2048 inputs per batch
    const BATCH_SIZE = 100
    const allEmbeddings: number[][] = []

    for (let i = 0; i < truncated.length; i += BATCH_SIZE) {
      const batch = truncated.slice(i, i + BATCH_SIZE)

      const response = await openai.embeddings.create({
        model: MODEL,
        input: batch,
        dimensions: DIMENSIONS,
      })

      // Sort by index to maintain order
      const sorted = response.data.sort((a, b) => a.index - b.index)
      allEmbeddings.push(...sorted.map(d => d.embedding))

      console.log(
        `✅ [OPENAI EMB] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} embeddings generated`
      )
    }

    return allEmbeddings
  } catch (error) {
    console.error('❌ [OPENAI EMB] Batch embedding failed:', error)
    throw new Error(
      `Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export const EMBEDDING_DIMENSIONS = DIMENSIONS
export const EMBEDDING_MODEL = MODEL
