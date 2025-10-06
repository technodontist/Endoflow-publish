/**
 * PDF Text Extraction Utility
 * Extracts text content and metadata from PDF files
 */

// Note: pdf-parse requires Buffer which is available in Node.js
// This utility should only be used in server-side code

export interface PDFExtractionResult {
  text: string
  title?: string
  author?: string
  pages: number
  metadata: Record<string, any>
}

/**
 * Extract text content from PDF file buffer
 * @param fileBuffer - PDF file as Buffer
 * @returns Extracted text and metadata
 */
export async function extractPDFContent(fileBuffer: Buffer): Promise<PDFExtractionResult> {
  try {
    // Use pdf2json for Next.js compatibility
    const PDFParser = (await import('pdf2json')).default
    
    return new Promise((resolve, reject) => {
      const pdfParser = new (PDFParser as any)(null, 1)
      
      pdfParser.on('pdfParser_dataError', (errData: any) => {
        console.error('❌ [PDF EXTRACTOR] PDF parse error:', errData.parserError)
        reject(new Error(`PDF parsing failed: ${errData.parserError}`))
      })
      
      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          // Extract text from all pages
          let fullText = ''
          let pageCount = 0
          
          if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
            pageCount = pdfData.Pages.length
            
            pdfData.Pages.forEach((page: any) => {
              if (page.Texts && Array.isArray(page.Texts)) {
                const pageText = page.Texts
                  .map((text: any) => {
                    if (text.R && Array.isArray(text.R)) {
                      return text.R
                        .map((r: any) => decodeURIComponent(r.T || ''))
                        .join(' ')
                    }
                    return ''
                  })
                  .join(' ')
                fullText += pageText + '\n\n'
              }
            })
          }
          
          // Extract metadata
          const metadata = pdfData.Meta || {}
          
          resolve({
            text: fullText.trim(),
            title: metadata.Title || undefined,
            author: metadata.Author || undefined,
            pages: pageCount,
            metadata: metadata
          })
        } catch (error) {
          reject(error)
        }
      })
      
      // Parse the PDF buffer
      pdfParser.parseBuffer(fileBuffer)
    })
  } catch (error) {
    console.error('❌ [PDF EXTRACTOR] PDF extraction error:', error)
    throw new Error(`Failed to extract PDF content: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Validate PDF file size and type
 * @param file - File object
 * @param maxSizeMB - Maximum file size in MB (default 10)
 * @returns Validation result
 */
export function validatePDFFile(file: File, maxSizeMB: number = 10): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'File must be a PDF' }
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024
  if (file.size > maxSizeBytes) {
    return { valid: false, error: `PDF file must be less than ${maxSizeMB}MB` }
  }

  return { valid: true }
}

/**
 * Extract keywords from text using simple heuristics
 * @param text - Text content
 * @returns Suggested keywords
 */
export function extractKeywords(text: string): {
  topics: string[]
  diagnoses: string[]
  treatments: string[]
} {
  const lowerText = text.toLowerCase()

  // Common endodontic topics
  const topicKeywords = [
    'root_canal', 'rct', 'endodontics', 'rotary_instrumentation',
    'bioceramic_sealers', 'obturation', 'apex_locator', 'pulp',
    'retreatment', 'apicoectomy', 'perforation', 'calcification'
  ]

  // Common diagnoses
  const diagnosisKeywords = [
    'irreversible_pulpitis', 'reversible_pulpitis', 'pulp_necrosis',
    'apical_periodontitis', 'apical_abscess', 'symptomatic',
    'asymptomatic', 'deep_caries', 'crown_fracture', 'root_fracture'
  ]

  // Common treatments
  const treatmentKeywords = [
    'rct', 'root_canal_treatment', 'pulpotomy', 'pulpectomy',
    'direct_pulp_capping', 'indirect_pulp_capping', 'apexification',
    'regeneration', 'retreatment', 'surgical_endodontics'
  ]

  const topics = topicKeywords.filter(kw => lowerText.includes(kw.replace(/_/g, ' ')))
  const diagnoses = diagnosisKeywords.filter(kw => lowerText.includes(kw.replace(/_/g, ' ')))
  const treatments = treatmentKeywords.filter(kw => lowerText.includes(kw.replace(/_/g, ' ')))

  return {
    topics: topics.slice(0, 5), // Limit to 5
    diagnoses: diagnoses.slice(0, 5),
    treatments: treatments.slice(0, 5)
  }
}
