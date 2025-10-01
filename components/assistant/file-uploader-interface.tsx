'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Upload,
  Search,
  User,
  FileImage,
  X,
  CheckCircle,
  AlertCircle,
  Camera,
  Zap,
  Eye
} from "lucide-react"
import { createClient } from '@/lib/supabase/client'
import { uploadPatientFileAction } from '@/lib/actions/patient-files'
import { format } from 'date-fns'

interface Patient {
  id: string
  first_name: string
  last_name: string
  date_of_birth?: string
  created_at: string
}

interface FileUpload {
  file: File
  preview: string
  type: string
  legend: string
  id: string
}

interface FileUploaderInterfaceProps {
  currentAssistantId: string
}

export function FileUploaderInterface({ currentAssistantId }: FileUploaderInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [allPatients, setAllPatients] = useState<Patient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  // Load all patients on component mount
  useEffect(() => {
    async function loadPatients() {
      try {
        const supabase = createClient()
        const { data: patients, error } = await supabase
          .schema('api')
          .from('patients')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error loading patients:', error)
          return
        }

        setAllPatients(patients || [])
        setFilteredPatients((patients || []).slice(0, 10))
      } catch (error) {
        console.error('Error loading patients:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPatients()
  }, [])

  // Filter patients based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPatients(allPatients.slice(0, 10))
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = allPatients.filter(patient => {
      const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase()
      return fullName.includes(query) ||
             patient.first_name.toLowerCase().includes(query) ||
             patient.last_name.toLowerCase().includes(query) ||
             patient.id.toLowerCase().includes(query)
    })

    setFilteredPatients(filtered.slice(0, 20))
  }, [searchQuery, allPatients])

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList) => {
    const newUploads: FileUpload[] = []

    Array.from(files).forEach(file => {
      // Only allow image files
      if (file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file)
        const fileType = getFileType(file.name)

        newUploads.push({
          file,
          preview,
          type: fileType,
          legend: '',
          id: Math.random().toString(36).substr(2, 9)
        })
      }
    })

    setFileUploads(prev => [...prev, ...newUploads])
  }, [])

  // Get file type based on filename
  const getFileType = (filename: string): string => {
    const lower = filename.toLowerCase()
    if (lower.includes('xray') || lower.includes('x-ray')) return 'X-Ray'
    if (lower.includes('oral') || lower.includes('intraoral')) return 'Oral Photo'
    if (lower.includes('extraoral') || lower.includes('face')) return 'Extraoral Photo'
    if (lower.includes('scan') || lower.includes('cbct')) return 'CBCT Scan'
    return 'Clinical Photo'
  }

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files)
    }
  }, [handleFileSelect])

  // Remove file from upload queue
  const removeFile = (id: string) => {
    setFileUploads(prev => {
      const fileToRemove = prev.find(f => f.id === id)
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview)
      }
      return prev.filter(f => f.id !== id)
    })
  }

  // Update file legend
  const updateFileLegend = (id: string, legend: string) => {
    setFileUploads(prev =>
      prev.map(f => f.id === id ? { ...f, legend } : f)
    )
  }

  // Update file type
  const updateFileType = (id: string, type: string) => {
    setFileUploads(prev =>
      prev.map(f => f.id === id ? { ...f, type } : f)
    )
  }

  // Handle file upload to server
  const handleUpload = async () => {
    if (!selectedPatient || fileUploads.length === 0) {
      alert('Please select a patient and add files to upload')
      return
    }

    // Validate that all files have legends
    const filesWithoutLegends = fileUploads.filter(f => !f.legend.trim())
    if (filesWithoutLegends.length > 0) {
      alert('Please add descriptions for all files before uploading')
      return
    }

    setIsUploading(true)

    try {
      let uploadedCount = 0
      const totalFiles = fileUploads.length

      // Upload files one by one
      for (const upload of fileUploads) {
        const formData = new FormData()
        formData.append('patientId', selectedPatient.id)
        formData.append('fileType', upload.type)
        formData.append('description', upload.legend)
        formData.append('file', upload.file)

        const result = await uploadPatientFileAction(formData)

        if (result.success) {
          uploadedCount++
          console.log(`Uploaded ${uploadedCount}/${totalFiles}: ${upload.file.name}`)
        } else {
          console.error(`Failed to upload ${upload.file.name}:`, result.error)
          throw new Error(`Failed to upload ${upload.file.name}: ${result.error}`)
        }
      }

      // Clear uploads after successful upload
      fileUploads.forEach(upload => URL.revokeObjectURL(upload.preview))
      setFileUploads([])

      alert(`Successfully uploaded ${uploadedCount} file${uploadedCount !== 1 ? 's' : ''} for ${selectedPatient.first_name} ${selectedPatient.last_name}!`)

    } catch (error) {
      console.error('Error uploading files:', error)
      alert(error instanceof Error ? error.message : 'Failed to upload files')
    } finally {
      setIsUploading(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy')
    } catch {
      return 'Invalid date'
    }
  }

  const fileTypes = [
    'X-Ray',
    'Oral Photo',
    'Extraoral Photo',
    'CBCT Scan',
    'Clinical Photo',
    'Panoramic X-Ray',
    'Bitewing X-Ray',
    'Periapical X-Ray',
    'Other'
  ]

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">File Uploader</h1>
          <p className="text-gray-600">Upload X-rays, oral photos, and other clinical images for patients</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FileImage className="w-4 h-4" />
          {fileUploads.length} files ready to upload
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Patient Selection */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Select Patient</CardTitle>
              <CardDescription>Choose a patient to upload files for</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search patients by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Loading patients...</p>
                  </div>
                ) : filteredPatients.length === 0 ? (
                  <div className="text-center py-8">
                    <User className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm text-gray-500">
                      {searchQuery ? 'No patients found' : 'No patients available'}
                    </p>
                  </div>
                ) : (
                  filteredPatients.map((patient) => {
                    const fullName = `${patient.first_name} ${patient.last_name}`
                    const initials = `${patient.first_name[0]}${patient.last_name[0]}`.toUpperCase()
                    const isSelected = selectedPatient?.id === patient.id

                    return (
                      <div
                        key={patient.id}
                        onClick={() => setSelectedPatient(patient)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-accent/50 ${
                          isSelected ? 'bg-teal-50 border-teal-200' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-teal-100' : 'bg-gray-100'
                          }`}>
                            <span className={`text-xs font-semibold ${
                              isSelected ? 'text-teal-600' : 'text-gray-600'
                            }`}>
                              {initials}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm truncate">{fullName}</h4>
                            <p className="text-xs text-gray-500">
                              Joined {formatDate(patient.created_at)}
                            </p>
                          </div>
                          {isSelected && (
                            <CheckCircle className="w-5 h-5 text-teal-600" />
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: File Upload */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Files
              </CardTitle>
              <CardDescription>
                {selectedPatient ?
                  `Uploading files for ${selectedPatient.first_name} ${selectedPatient.last_name}` :
                  'Select a patient to start uploading files'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedPatient ? (
                <>
                  {/* File Drop Zone */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      dragActive ? 'border-teal-400 bg-teal-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <Camera className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      Drop images here or click to browse
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      Supports: JPG, PNG, JPEG (Max 10MB each)
                    </p>
                    <Input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      Choose Files
                    </Button>
                  </div>

                  {/* File Preview List */}
                  {fileUploads.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Files to Upload ({fileUploads.length})</h4>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {fileUploads.map((upload) => (
                          <Card key={upload.id} className="p-3">
                            <div className="flex gap-3">
                              {/* Image Preview */}
                              <div className="flex-shrink-0">
                                <img
                                  src={upload.preview}
                                  alt="Preview"
                                  className="w-16 h-16 object-cover rounded border"
                                />
                              </div>

                              {/* File Details */}
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-sm truncate">
                                    {upload.file.name}
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeFile(upload.id)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label htmlFor={`type-${upload.id}`} className="text-xs">
                                      File Type
                                    </Label>
                                    <Select
                                      value={upload.type}
                                      onValueChange={(value) => updateFileType(upload.id, value)}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {fileTypes.map((type) => (
                                          <SelectItem key={type} value={type} className="text-xs">
                                            {type}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <Badge variant="outline" className="text-xs">
                                      {(upload.file.size / 1024 / 1024).toFixed(1)} MB
                                    </Badge>
                                  </div>
                                </div>

                                <div>
                                  <Label htmlFor={`legend-${upload.id}`} className="text-xs">
                                    Description *
                                  </Label>
                                  <Textarea
                                    id={`legend-${upload.id}`}
                                    placeholder="Describe what this image shows..."
                                    value={upload.legend}
                                    onChange={(e) => updateFileLegend(upload.id, e.target.value)}
                                    className="h-16 text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload Button */}
                  {fileUploads.length > 0 && (
                    <Button
                      onClick={handleUpload}
                      disabled={isUploading || fileUploads.some(f => !f.legend.trim())}
                      className="w-full bg-teal-600 hover:bg-teal-700"
                    >
                      {isUploading ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                          Uploading Files...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload {fileUploads.length} File{fileUploads.length !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <Eye className="w-16 w-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold mb-2">Select a Patient</h3>
                  <p className="text-gray-500">
                    Choose a patient from the list to start uploading medical images
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}