'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, Upload, X, Loader2, CheckCircle2, AlertCircle, Plus, FileText } from 'lucide-react'
import { uploadMedicalKnowledgeAction, uploadMedicalKnowledgeFromPDFAction } from '@/lib/actions/medical-knowledge'
import { cn } from '@/lib/utils'

interface MedicalKnowledgeUploaderProps {
  onUploadComplete?: () => void
}

export default function MedicalKnowledgeUploader({ onUploadComplete }: MedicalKnowledgeUploaderProps) {
  const [uploadMode, setUploadMode] = useState<'text' | 'pdf'>('pdf')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sourceType, setSourceType] = useState<'textbook' | 'research_paper' | 'clinical_protocol' | 'case_study' | 'guideline'>('research_paper')
  const [specialty, setSpecialty] = useState<'endodontics' | 'periodontics' | 'prosthodontics' | 'oral_surgery' | 'general_dentistry'>('endodontics')
  const [authors, setAuthors] = useState('')
  const [publicationYear, setPublicationYear] = useState('')
  const [journal, setJournal] = useState('')
  const [doi, setDoi] = useState('')
  const [url, setUrl] = useState('')
  const [isbn, setIsbn] = useState('')
  const [topicsInput, setTopicsInput] = useState('')
  const [diagnosisKeywordsInput, setDiagnosisKeywordsInput] = useState('')
  const [treatmentKeywordsInput, setTreatmentKeywordsInput] = useState('')
  const [topics, setTopics] = useState<string[]>([])
  const [diagnosisKeywords, setDiagnosisKeywords] = useState<string[]>([])
  const [treatmentKeywords, setTreatmentKeywords] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [extractedText, setExtractedText] = useState('')

  const sourceTypeOptions = [
    { value: 'textbook', label: 'Textbook' },
    { value: 'research_paper', label: 'Research Paper' },
    { value: 'clinical_protocol', label: 'Clinical Protocol' },
    { value: 'case_study', label: 'Case Study' },
    { value: 'guideline', label: 'Clinical Guideline' }
  ]

  const specialtyOptions = [
    { value: 'endodontics', label: 'Endodontics' },
    { value: 'periodontics', label: 'Periodontics' },
    { value: 'prosthodontics', label: 'Prosthodontics' },
    { value: 'oral_surgery', label: 'Oral Surgery' },
    { value: 'general_dentistry', label: 'General Dentistry' }
  ]

  const addTag = (type: 'topic' | 'diagnosis' | 'treatment', value: string) => {
    if (!value.trim()) return

    const tag = value.trim().toLowerCase().replace(/\s+/g, '_')

    if (type === 'topic' && !topics.includes(tag)) {
      setTopics([...topics, tag])
      setTopicsInput('')
    } else if (type === 'diagnosis' && !diagnosisKeywords.includes(tag)) {
      setDiagnosisKeywords([...diagnosisKeywords, tag])
      setDiagnosisKeywordsInput('')
    } else if (type === 'treatment' && !treatmentKeywords.includes(tag)) {
      setTreatmentKeywords([...treatmentKeywords, tag])
      setTreatmentKeywordsInput('')
    }
  }

  const removeTag = (type: 'topic' | 'diagnosis' | 'treatment', tag: string) => {
    if (type === 'topic') {
      setTopics(topics.filter(t => t !== tag))
    } else if (type === 'diagnosis') {
      setDiagnosisKeywords(diagnosisKeywords.filter(k => k !== tag))
    } else if (type === 'treatment') {
      setTreatmentKeywords(treatmentKeywords.filter(k => k !== tag))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Please select a PDF file')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('PDF file must be less than 10MB')
        return
      }
      setPdfFile(file)
      setError(null)
      // Auto-set title from filename if empty
      if (!title) {
        setTitle(file.name.replace('.pdf', ''))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Validation for PDF mode
      if (uploadMode === 'pdf' && !pdfFile) {
        setError('Please select a PDF file')
        setLoading(false)
        return
      }

      // Validation for text mode
      if (uploadMode === 'text' && (!title.trim() || !content.trim())) {
        setError('Title and content are required')
        setLoading(false)
        return
      }

      if (topics.length === 0 || diagnosisKeywords.length === 0 || treatmentKeywords.length === 0) {
        setError('Please add at least one topic, diagnosis keyword, and treatment keyword')
        setLoading(false)
        return
      }

      let result
      if (uploadMode === 'pdf' && pdfFile) {
        result = await uploadMedicalKnowledgeFromPDFAction({
          pdfFile,
          title: title || pdfFile.name.replace('.pdf', ''),
          sourceType,
          specialty,
          authors: authors || undefined,
          publicationYear: publicationYear ? parseInt(publicationYear) : undefined,
          journal: journal || undefined,
          doi: doi || undefined,
          url: url || undefined,
          isbn: isbn || undefined,
          topics,
          diagnosisKeywords,
          treatmentKeywords
        })
        
        if (result.success && result.extractedText) {
          setExtractedText(result.extractedText)
        }
      } else {
        result = await uploadMedicalKnowledgeAction({
          title,
          content,
          sourceType,
          specialty,
          authors: authors || undefined,
          publicationYear: publicationYear ? parseInt(publicationYear) : undefined,
          journal: journal || undefined,
          doi: doi || undefined,
          url: url || undefined,
          isbn: isbn || undefined,
          topics,
          diagnosisKeywords,
          treatmentKeywords
        })
      }

      if (result.success) {
        setSuccess(true)
        // Reset form
        setTitle('')
        setContent('')
        setPdfFile(null)
        setExtractedText('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        setAuthors('')
        setPublicationYear('')
        setJournal('')
        setDoi('')
        setUrl('')
        setIsbn('')
        setTopics([])
        setDiagnosisKeywords([])
        setTreatmentKeywords([])
        setTopicsInput('')
        setDiagnosisKeywordsInput('')
        setTreatmentKeywordsInput('')

        // Call callback
        onUploadComplete?.()

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(result.error || 'Failed to upload medical knowledge')
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-teal-600" />
          Upload Medical Knowledge
        </CardTitle>
        <CardDescription>
          Add textbooks, research papers, or clinical protocols to enhance AI treatment suggestions
        </CardDescription>
      </CardHeader>

      <CardContent>
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Medical knowledge uploaded successfully!</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Upload Mode Selector */}
          <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as 'text' | 'pdf')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pdf" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Upload PDF
              </TabsTrigger>
              <TabsTrigger value="text" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Paste Text
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pdf" className="space-y-4 mt-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-teal-500 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="pdf-upload"
                />
                <label htmlFor="pdf-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-12 w-12 text-gray-400" />
                    <div className="text-sm">
                      {pdfFile ? (
                        <div className="flex items-center gap-2 text-teal-600 font-medium">
                          <FileText className="h-4 w-4" />
                          {pdfFile.name}
                          <span className="text-gray-500">({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                        </div>
                      ) : (
                        <>
                          <p className="text-gray-600 font-medium">Click to upload PDF or drag and drop</p>
                          <p className="text-gray-400 text-xs mt-1">Maximum file size: 10MB</p>
                        </>
                      )}
                    </div>
                  </div>
                </label>
                {pdfFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setPdfFile(null)
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Remove File
                  </Button>
                )}
              </div>
              {extractedText && (
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Extracted Text Preview:</Label>
                  <p className="text-xs text-gray-600 max-h-32 overflow-y-auto font-mono">
                    {extractedText.substring(0, 500)}...
                  </p>
                  <p className="text-xs text-gray-500 mt-2">{extractedText.length} characters extracted</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="text" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="content">Content / Abstract *</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste the full text, abstract, or key findings from the medical source..."
                  rows={8}
                  required={uploadMode === 'text'}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {content.length} characters • More detailed content improves AI accuracy
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">Basic Information</h3>

            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Modern Endodontic Treatment Success Rates"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sourceType">Source Type *</Label>
                <Select value={sourceType} onValueChange={(value: any) => setSourceType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceTypeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="specialty">Specialty *</Label>
                <Select value={specialty} onValueChange={(value: any) => setSpecialty(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {specialtyOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

          </div>

          {/* Publication Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">Publication Details (Optional)</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="authors">Authors</Label>
                <Input
                  id="authors"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  placeholder="Smith J, Johnson K"
                />
              </div>

              <div>
                <Label htmlFor="publicationYear">Publication Year</Label>
                <Input
                  id="publicationYear"
                  type="number"
                  value={publicationYear}
                  onChange={(e) => setPublicationYear(e.target.value)}
                  placeholder="2024"
                  min="1900"
                  max={new Date().getFullYear()}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="journal">Journal / Publisher</Label>
                <Input
                  id="journal"
                  value={journal}
                  onChange={(e) => setJournal(e.target.value)}
                  placeholder="Journal of Endodontics"
                />
              </div>

              <div>
                <Label htmlFor="doi">DOI</Label>
                <Input
                  id="doi"
                  value={doi}
                  onChange={(e) => setDoi(e.target.value)}
                  placeholder="10.1016/j.joen.2024.001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label htmlFor="isbn">ISBN (for textbooks)</Label>
                <Input
                  id="isbn"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="978-0-123456-78-9"
                />
              </div>
            </div>
          </div>

          {/* Keywords & Tags */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">Keywords & Tags (Required for AI matching)</h3>

            {/* Topics */}
            <div>
              <Label htmlFor="topics">Topics *</Label>
              <div className="flex gap-2">
                <Input
                  id="topics"
                  value={topicsInput}
                  onChange={(e) => setTopicsInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag('topic', topicsInput)
                    }
                  }}
                  placeholder="e.g., root_canal, rotary_instrumentation"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => addTag('topic', topicsInput)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {topics.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {topics.map(topic => (
                    <Badge key={topic} variant="secondary" className="gap-1">
                      {topic}
                      <button
                        type="button"
                        onClick={() => removeTag('topic', topic)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Diagnosis Keywords */}
            <div>
              <Label htmlFor="diagnosisKeywords">Diagnosis Keywords *</Label>
              <div className="flex gap-2">
                <Input
                  id="diagnosisKeywords"
                  value={diagnosisKeywordsInput}
                  onChange={(e) => setDiagnosisKeywordsInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag('diagnosis', diagnosisKeywordsInput)
                    }
                  }}
                  placeholder="e.g., irreversible_pulpitis, apical_periodontitis"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => addTag('diagnosis', diagnosisKeywordsInput)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {diagnosisKeywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {diagnosisKeywords.map(keyword => (
                    <Badge key={keyword} variant="outline" className="gap-1 border-blue-300 text-blue-700">
                      {keyword}
                      <button
                        type="button"
                        onClick={() => removeTag('diagnosis', keyword)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Treatment Keywords */}
            <div>
              <Label htmlFor="treatmentKeywords">Treatment Keywords *</Label>
              <div className="flex gap-2">
                <Input
                  id="treatmentKeywords"
                  value={treatmentKeywordsInput}
                  onChange={(e) => setTreatmentKeywordsInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag('treatment', treatmentKeywordsInput)
                    }
                  }}
                  placeholder="e.g., rct, root_canal_treatment, rotary_files"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => addTag('treatment', treatmentKeywordsInput)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {treatmentKeywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {treatmentKeywords.map(keyword => (
                    <Badge key={keyword} variant="outline" className="gap-1 border-green-300 text-green-700">
                      {keyword}
                      <button
                        type="button"
                        onClick={() => removeTag('treatment', keyword)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="submit"
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading & Generating Embeddings...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Medical Knowledge
                </>
              )}
            </Button>
          </div>

          <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="font-medium text-blue-700 mb-1">💡 How it works:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-600">
              <li>Your content is processed with OpenAI embeddings (1536-dimensional vectors)</li>
              <li>Stored in Supabase pgvector for fast semantic search</li>
              <li>AI Co-Pilot uses this knowledge to provide evidence-based treatment suggestions</li>
            </ol>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
