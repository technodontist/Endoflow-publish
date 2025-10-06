# 📄 PDF Upload Implementation Guide

## ✅ What Was Fixed

### Phase 1: Schema Fixes (COMPLETED)

**Problem**: Upload was failing due to missing `api.` schema prefix

**Fixed Files**:
- `lib/actions/medical-knowledge.ts` - Added `.schema('api')` to all Supabase queries

**Changes Made**:
```typescript
// BEFORE (❌ Wrong)
await supabase.from('medical_knowledge').insert({...})

// AFTER (✅ Fixed)
await supabase.schema('api').from('medical_knowledge').insert({...})
```

**All 4 functions updated**:
1. `uploadMedicalKnowledgeAction` ✅
2. `getMedicalKnowledgeAction` ✅
3. `deleteMedicalKnowledgeAction` ✅
4. `getKnowledgeStatsAction` ✅

### Testing the Fix

Try uploading medical knowledge now:
1. Login as dentist
2. Go to "Medical Knowledge" tab
3. Fill form with sample data
4. Click Upload

Should work now with proper schema reference!

---

## 📋 PDF Upload Implementation (TODO)

### Phase 2: Add PDF Support

Since npm install timed out, here's the manual implementation:

#### **Step 1: Install PDF Parser**

```bash
npm install pdf-parse
npm install @types/pdf-parse --save-dev
```

#### **Step 2: Create PDF Extractor Utility**

Create file: `lib/utils/pdf-extractor.ts`

```typescript
'use server'

import pdf from 'pdf-parse'

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
    const data = await pdf(fileBuffer)

    return {
      text: data.text,
      title: data.info?.Title,
      author: data.info?.Author,
      pages: data.numpages,
      metadata: data.info || {}
    }
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error('Failed to extract PDF content')
  }
}
```

#### **Step 3: Update Server Action**

Add to `lib/actions/medical-knowledge.ts`:

```typescript
/**
 * Upload medical knowledge from PDF file
 */
export async function uploadMedicalKnowledgeFromPDFAction(formData: FormData) {
  try {
    const supabase = await createServiceClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'dentist' || profile.status !== 'active') {
      return { success: false, error: 'Only active dentists can upload' }
    }

    // Extract PDF file
    const file = formData.get('pdf') as File
    if (!file) {
      return { success: false, error: 'No PDF file provided' }
    }

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    console.log('📄 [PDF UPLOAD] Extracting text from PDF...')

    // Extract text
    const { extractPDFContent } = await import('@/lib/utils/pdf-extractor')
    const pdfData = await extractPDFContent(buffer)

    console.log(`✅ [PDF UPLOAD] Extracted ${pdfData.text.length} characters from ${pdfData.pages} pages`)

    // Get other form data
    const title = (formData.get('title') as string) || pdfData.title || 'Untitled Document'
    const sourceType = formData.get('sourceType') as string || 'research_paper'
    const specialty = formData.get('specialty') as string || 'endodontics'
    const authors = (formData.get('authors') as string) || pdfData.author || ''
    const publicationYear = formData.get('publicationYear') as string
    const journal = formData.get('journal') as string
    const doi = formData.get('doi') as string
    const topics = JSON.parse(formData.get('topics') as string || '[]')
    const diagnosisKeywords = JSON.parse(formData.get('diagnosisKeywords') as string || '[]')
    const treatmentKeywords = JSON.parse(formData.get('treatmentKeywords') as string || '[]')

    // Generate embedding
    const embeddingText = `${title}\n\n${pdfData.text.substring(0, 5000)}` // Limit to 5000 chars

    const { generateEmbedding } = await import('@/lib/services/gemini-ai')
    const embedding = await generateEmbedding(embeddingText, 'RETRIEVAL_DOCUMENT')

    // Insert to database
    const { data: knowledgeEntry, error: insertError } = await supabase
      .schema('api')
      .from('medical_knowledge')
      .insert({
        title,
        content: pdfData.text,
        source_type: sourceType,
        specialty,
        authors: authors || null,
        publication_year: publicationYear ? parseInt(publicationYear) : null,
        journal: journal || null,
        doi: doi || null,
        embedding: embedding,
        topics,
        diagnosis_keywords: diagnosisKeywords,
        treatment_keywords: treatmentKeywords,
        uploaded_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ [PDF UPLOAD] Database insert failed:', insertError)
      return { success: false, error: insertError.message }
    }

    console.log('✅ [PDF UPLOAD] Successfully uploaded PDF:', knowledgeEntry.id)

    revalidatePath('/dentist')
    return { success: true, data: knowledgeEntry, extractedText: pdfData.text }

  } catch (error) {
    console.error('❌ [PDF UPLOAD] Error:', error)
    return { success: false, error: 'Failed to upload PDF' }
  }
}
```

#### **Step 4: Update UI Component**

Add to `components/dentist/medical-knowledge-uploader.tsx`:

```typescript
// Add state
const [uploadMode, setUploadMode] = useState<'text' | 'pdf'>('text')
const [pdfFile, setPdfFile] = useState<File | null>(null)
const [extractedText, setExtractedText] = useState('')
const [extracting, setExtracting] = useState(false)

// Add PDF handler
const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return

  if (file.type !== 'application/pdf') {
    setError('Please upload a PDF file')
    return
  }

  if (file.size > 10 * 1024 * 1024) { // 10MB limit
    setError('PDF file must be less than 10MB')
    return
  }

  setPdfFile(file)
  setExtracting(true)
  setError(null)

  try {
    // Extract text using server action
    const formData = new FormData()
    formData.append('pdf', file)

    const { extractPDFContent } = await import('@/lib/utils/pdf-extractor')
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const result = await extractPDFContent(buffer)

    setExtractedText(result.text)
    setContent(result.text)
    if (result.title) setTitle(result.title)
    if (result.author) setAuthors(result.author)

    setExtracting(false)
  } catch (err) {
    console.error('PDF extraction error:', err)
    setError('Failed to extract text from PDF')
    setExtracting(false)
  }
}

// Add to form UI (before Basic Information section)
<div className="space-y-4 border-b pb-6">
  <Label>Upload Method</Label>
  <div className="flex gap-4">
    <Button
      type="button"
      variant={uploadMode === 'text' ? 'default' : 'outline'}
      onClick={() => setUploadMode('text')}
    >
      📝 Paste Text
    </Button>
    <Button
      type="button"
      variant={uploadMode === 'pdf' ? 'default' : 'outline'}
      onClick={() => setUploadMode('pdf')}
    >
      📄 Upload PDF
    </Button>
  </div>
</div>

{uploadMode === 'pdf' && (
  <div className="space-y-4 bg-blue-50 p-4 rounded-lg">
    <Label htmlFor="pdf">PDF File *</Label>
    <Input
      id="pdf"
      type="file"
      accept=".pdf"
      onChange={handlePDFUpload}
      disabled={extracting}
    />
    {extracting && (
      <div className="text-sm text-blue-600 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Extracting text from PDF...
      </div>
    )}
    {extractedText && (
      <div className="text-sm text-green-600">
        ✅ Extracted {extractedText.length} characters from PDF
      </div>
    )}
  </div>
)}
```

---

## 🎯 Complete Implementation Checklist

### ✅ Completed
- [x] Fix schema references in server actions
- [x] Add enhanced error messages
- [x] Document PDF implementation steps

### 📋 TODO (Manual Steps)
- [ ] Run: `npm install pdf-parse @types/pdf-parse`
- [ ] Create: `lib/utils/pdf-extractor.ts`
- [ ] Add: `uploadMedicalKnowledgeFromPDFAction` to actions
- [ ] Update: UI component with PDF upload
- [ ] Test: Upload both text and PDF

---

## 🧪 Testing After Implementation

### Test Text Upload:
```
1. Go to Medical Knowledge tab
2. Select "Paste Text" mode
3. Fill form manually
4. Click Upload
5. Should work with schema fix! ✅
```

### Test PDF Upload:
```
1. Go to Medical Knowledge tab
2. Select "Upload PDF" mode
3. Choose a PDF research paper
4. Wait for text extraction
5. Auto-fills title/author from PDF metadata
6. Review extracted text
7. Add tags manually
8. Click Upload
9. Should save to database ✅
```

---

## 💡 Quick Workaround (Until PDF Implemented)

**For now**, you can:
1. Open PDF in Adobe Reader
2. Select All (Ctrl+A)
3. Copy text (Ctrl+C)
4. Paste into "Content" field
5. Fill other fields manually
6. Upload - **This should work now!** ✅

The schema fix should resolve your current upload issues. PDF support will enhance UX but isn't blocking.

---

## 📚 Benefits After Full Implementation

### Text Upload (Working Now):
- ✅ Schema fixed
- ✅ Manual paste still available
- ✅ Full control over content

### PDF Upload (After Implementation):
- ✅ Drag & drop PDF files
- ✅ Automatic text extraction
- ✅ Auto-fill title/author from metadata
- ✅ Preview extracted text
- ✅ Save time vs manual copy/paste

---

**Current Status**: Text upload should work now. PDF upload needs manual implementation following steps above.

**Priority**: Test text upload first to confirm schema fix worked!
