'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Search,
  Filter,
  Calendar,
  FileImage,
  Download,
  Eye,
  User,
  Camera,
  Zap,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink
} from "lucide-react"
import { getPatientFilesAction, getFileUrlAction } from '@/lib/actions/patient-files'
import { format } from 'date-fns'

export interface PatientFile {
  id: string
  patientId: string
  uploadedBy: string
  fileName: string
  originalFileName: string
  filePath: string
  fileSize: number
  mimeType: string
  fileType: string
  description: string
  isArchived: boolean
  createdAt: string
  updatedAt: string
  uploader?: {
    id: string
    full_name: string
  }
}

interface PatientFilesViewerProps {
  patientId: string
  viewMode?: 'patient' | 'dentist' | 'assistant'
  showUploader?: boolean
  showPatientInfo?: boolean
  maxHeight?: string
}

export function PatientFilesViewer({
  patientId,
  viewMode = 'patient',
  showUploader = false,
  showPatientInfo = false,
  maxHeight = "600px"
}: PatientFilesViewerProps) {
  const [files, setFiles] = useState<PatientFile[]>([])
  const [filteredFiles, setFilteredFiles] = useState<PatientFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFileType, setSelectedFileType] = useState<string>('all')
  const [selectedFile, setSelectedFile] = useState<PatientFile | null>(null)
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null)
  const [loadingFileUrl, setLoadingFileUrl] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  // File type configuration
  const fileTypes = [
    { value: 'all', label: 'All Files', icon: FileImage },
    { value: 'X-Ray', label: 'X-Rays', icon: Zap },
    { value: 'Oral Photo', label: 'Oral Photos', icon: Camera },
    { value: 'CBCT Scan', label: 'CBCT Scans', icon: FileImage },
    { value: 'Treatment Plan', label: 'Treatment Plans', icon: FileImage },
    { value: 'Progress Photo', label: 'Progress Photos', icon: Camera },
    { value: 'Insurance Form', label: 'Insurance Forms', icon: FileImage },
  ]

  // Load patient files
  useEffect(() => {
    const loadFiles = async () => {
      try {
        setLoading(true)
        setError(null)

        const result = await getPatientFilesAction(patientId)

        if (result.success) {
          setFiles(result.data || [])
        } else {
          setError(result.error || 'Failed to load patient files')
        }
      } catch (err) {
        console.error('Error loading files:', err)
        setError('Failed to load patient files')
      } finally {
        setLoading(false)
      }
    }

    if (patientId) {
      loadFiles()
    }
  }, [patientId])

  // Filter files based on search and type
  useEffect(() => {
    let filtered = files

    // Filter by file type
    if (selectedFileType !== 'all') {
      filtered = filtered.filter(file => file.fileType === selectedFileType)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(file =>
        file.originalFileName.toLowerCase().includes(query) ||
        file.description.toLowerCase().includes(query) ||
        file.fileType.toLowerCase().includes(query)
      )
    }

    setFilteredFiles(filtered)
  }, [files, selectedFileType, searchQuery])

  // Load file URL for viewing
  const handleViewFile = async (file: PatientFile) => {
    try {
      setLoadingFileUrl(true)
      setSelectedFile(file)
      setZoom(1)
      setRotation(0)

      const result = await getFileUrlAction(file.filePath)

      if (result.success) {
        setSelectedFileUrl(result.url)
      } else {
        setError('Failed to load file for viewing')
      }
    } catch (err) {
      console.error('Error loading file URL:', err)
      setError('Failed to load file for viewing')
    } finally {
      setLoadingFileUrl(false)
    }
  }

  // Download file
  const handleDownloadFile = async (file: PatientFile) => {
    try {
      const result = await getFileUrlAction(file.filePath)

      if (result.success) {
        const link = document.createElement('a')
        link.href = result.url
        link.download = file.originalFileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        setError('Failed to download file')
      }
    } catch (err) {
      console.error('Error downloading file:', err)
      setError('Failed to download file')
    }
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Get file type icon
  const getFileTypeIcon = (fileType: string) => {
    const typeConfig = fileTypes.find(type => type.value === fileType)
    return typeConfig?.icon || FileImage
  }

  // Navigate between files in modal
  const navigateFile = (direction: 'prev' | 'next') => {
    if (!selectedFile) return

    const currentIndex = filteredFiles.findIndex(file => file.id === selectedFile.id)
    let newIndex

    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : filteredFiles.length - 1
    } else {
      newIndex = currentIndex < filteredFiles.length - 1 ? currentIndex + 1 : 0
    }

    handleViewFile(filteredFiles[newIndex])
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Patient Files</CardTitle>
          <CardDescription>Loading medical files...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Patient Files</CardTitle>
          <CardDescription>Error loading files</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            Patient Medical Files
            <Badge variant="secondary">
              {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
          <CardDescription>
            Medical images and documents for this patient
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search files by name, description, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={selectedFileType} onValueChange={setSelectedFileType}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  {fileTypes.map((type) => {
                    const Icon = type.icon
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Files Grid */}
          {filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <FileImage className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
              <p className="text-gray-500">
                {files.length === 0
                  ? "No medical files have been uploaded for this patient yet."
                  : "No files match your current search criteria."
                }
              </p>
            </div>
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto"
              style={{ maxHeight }}
            >
              {filteredFiles.map((file) => {
                const FileTypeIcon = getFileTypeIcon(file.fileType)

                return (
                  <Card key={file.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileTypeIcon className="h-5 w-5 text-teal-600" />
                          <Badge variant="outline" className="text-xs">
                            {file.fileType}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatFileSize(file.fileSize)}
                        </div>
                      </div>

                      <h4 className="font-medium text-sm mb-2 truncate" title={file.originalFileName}>
                        {file.originalFileName}
                      </h4>

                      <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                        {file.description}
                      </p>

                      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {(() => {
                            try {
                              if (!file.createdAt) return 'Unknown date'
                              const date = new Date(file.createdAt)
                              if (isNaN(date.getTime())) return 'Invalid date'
                              return format(date, 'MMM d, yyyy')
                            } catch {
                              return 'Invalid date'
                            }
                          })()}
                        </div>
                        {showUploader && file.uploader && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {file.uploader.full_name}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleViewFile(file)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </DialogTrigger>

                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
                            <DialogHeader>
                              <DialogTitle className="flex items-center justify-between">
                                <span className="truncate mr-4">{selectedFile?.originalFileName}</span>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigateFile('prev')}
                                    disabled={filteredFiles.length <= 1}
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </Button>
                                  <span className="text-sm text-gray-500">
                                    {filteredFiles.findIndex(f => f.id === selectedFile?.id) + 1} of {filteredFiles.length}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigateFile('next')}
                                    disabled={filteredFiles.length <= 1}
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              </DialogTitle>
                            </DialogHeader>

                            <div className="flex flex-col h-full">
                              {/* Image Controls */}
                              <div className="flex items-center justify-between mb-4 p-2 bg-gray-50 rounded">
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                                    disabled={zoom <= 0.5}
                                  >
                                    <ZoomOut className="h-4 w-4" />
                                  </Button>
                                  <span className="text-sm font-medium">{Math.round(zoom * 100)}%</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                                    disabled={zoom >= 3}
                                  >
                                    <ZoomIn className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setRotation((rotation + 90) % 360)}
                                  >
                                    <RotateCw className="h-4 w-4" />
                                  </Button>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => selectedFile && handleDownloadFile(selectedFile)}
                                  >
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                  </Button>
                                </div>
                              </div>

                              {/* Image Display */}
                              <div className="flex-1 overflow-auto bg-gray-50 rounded flex items-center justify-center">
                                {loadingFileUrl ? (
                                  <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                                  </div>
                                ) : selectedFileUrl ? (
                                  <img
                                    src={selectedFileUrl}
                                    alt={selectedFile?.description || 'Medical file'}
                                    className="max-w-full max-h-full object-contain transition-transform"
                                    style={{
                                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                    }}
                                  />
                                ) : (
                                  <div className="text-center py-12">
                                    <FileImage className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-500">Failed to load image</p>
                                  </div>
                                )}
                              </div>

                              {/* File Information */}
                              {selectedFile && (
                                <div className="mt-4 p-4 bg-gray-50 rounded">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium">Description:</span>
                                      <p className="mt-1 text-gray-600">{selectedFile.description}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium">File Details:</span>
                                      <div className="mt-1 text-gray-600 space-y-1">
                                        <p>Type: {selectedFile.fileType}</p>
                                        <p>Size: {formatFileSize(selectedFile.fileSize)}</p>
                                        <p>Uploaded: {(() => {
                                          try {
                                            if (!selectedFile.createdAt) return 'Unknown date'
                                            const date = new Date(selectedFile.createdAt)
                                            if (isNaN(date.getTime())) return 'Invalid date'
                                            return format(date, 'PPP')
                                          } catch {
                                            return 'Invalid date'
                                          }
                                        })()}</p>
                                        {selectedFile.uploader && (
                                          <p>By: {selectedFile.uploader.full_name}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownloadFile(file)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}