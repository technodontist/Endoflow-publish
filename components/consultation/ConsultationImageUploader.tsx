'use client'

/**
 * ConsultationImageUploader
 *
 * Compact drag & drop zone for uploading X-rays, oral photos, CBCT scans
 * during a consultation. Uses existing uploadPatientFileAction.
 *
 * Session 12: Phase E — Consultation Image Upload
 */

import React, { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ImagePlus, X, Upload, Loader2, ChevronDown, ChevronUp,
  FileImage, AlertCircle, CheckCircle,
} from 'lucide-react'
import { uploadPatientFileAction } from '@/lib/actions/patient-files'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────

export interface UploadedImage {
  id: string              // patient_files record ID
  fileName: string
  fileType: string        // X-Ray, Oral Photo, etc.
  description: string
  previewUrl: string      // local blob URL for preview
  filePath: string        // Supabase storage path
  status: 'uploading' | 'done' | 'error'
  errorMessage?: string
}

interface ConsultationImageUploaderProps {
  patientId: string
  consultationId?: string
  images: UploadedImage[]
  onImagesChange: (images: UploadedImage[]) => void
  maxImages?: number
}

// ─── File type options ───────────────────────────────────

const fileTypeOptions = [
  'X-Ray',
  'Oral Photo',
  'CBCT Scan',
  'Intraoral Photo',
  'Extraoral Photo',
  'Treatment Progress',
  'Other',
]

// ─── Component ───────────────────────────────────────────

export function ConsultationImageUploader({
  patientId,
  consultationId,
  images,
  onImagesChange,
  maxImages = 10,
}: ConsultationImageUploaderProps) {
  const [isExpanded, setIsExpanded] = useState(images.length > 0)
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFileType, setSelectedFileType] = useState('X-Ray')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Upload handler ────────────────────────────────────
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const remaining = maxImages - images.length
    if (remaining <= 0) return

    const filesToUpload = fileArray
      .filter(f => f.type.startsWith('image/'))
      .slice(0, remaining)

    if (filesToUpload.length === 0) return

    // Create placeholder entries with local previews
    const newImages: UploadedImage[] = filesToUpload.map(file => ({
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      fileName: file.name,
      fileType: selectedFileType,
      description: `${selectedFileType} - ${file.name}`,
      previewUrl: URL.createObjectURL(file),
      filePath: '',
      status: 'uploading' as const,
    }))

    const updatedImages = [...images, ...newImages]
    onImagesChange(updatedImages)

    // Upload each file
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i]
      const tempImage = newImages[i]

      try {
        const formData = new FormData()
        formData.append('patientId', patientId)
        formData.append('fileType', selectedFileType)
        formData.append('description', `${selectedFileType} - ${file.name}`)
        formData.append('file', file)

        const result = await uploadPatientFileAction(formData)

        if (result.success && result.data) {
          // Update the image entry with server data — read current state via ref workaround
          onImagesChange(updatedImages.map(img =>
            img.id === tempImage.id
              ? {
                  ...img,
                  id: result.data.id,
                  filePath: result.data.file_path,
                  status: 'done' as const,
                }
              : img
          ))
          // Also update local reference
          const idx = updatedImages.findIndex(img => img.id === tempImage.id)
          if (idx >= 0) {
            updatedImages[idx] = { ...updatedImages[idx], id: result.data.id, filePath: result.data.file_path, status: 'done' }
          }
        } else {
          onImagesChange(updatedImages.map(img =>
            img.id === tempImage.id
              ? { ...img, status: 'error' as const, errorMessage: result.error || 'Upload failed' }
              : img
          ))
        }
      } catch (err) {
        onImagesChange(updatedImages.map(img =>
          img.id === tempImage.id
            ? { ...img, status: 'error' as const, errorMessage: 'Network error' }
            : img
        ))
      }
    }
  }, [images, maxImages, patientId, selectedFileType, onImagesChange])

  // ─── Drag & Drop ──────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  // ─── Remove image ─────────────────────────────────────
  const removeImage = useCallback((imageId: string) => {
    onImagesChange(images.filter(img => img.id !== imageId))
  }, [images, onImagesChange])

  const successCount = images.filter(i => i.status === 'done').length
  const uploadingCount = images.filter(i => i.status === 'uploading').length

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header — always visible, click to toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileImage className="w-4 h-4 text-teal-400" />
          <span className="text-sm font-medium text-foreground">Clinical Images</span>
          {images.length > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 border-border">
              {successCount}/{images.length}
            </Badge>
          )}
          {uploadingCount > 0 && (
            <Loader2 className="w-3 h-3 animate-spin text-teal-400" />
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* File type selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Type:</span>
            {fileTypeOptions.map(type => (
              <button
                key={type}
                onClick={() => setSelectedFileType(type)}
                className={cn(
                  'text-[11px] px-2.5 py-1 rounded-full border transition-all',
                  selectedFileType === type
                    ? 'bg-teal-500/15 text-teal-400 border-teal-500/30'
                    : 'bg-card text-muted-foreground border-border hover:border-teal-500/30 hover:text-foreground'
                )}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Drop zone */}
          {images.length < maxImages && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all',
                isDragOver
                  ? 'border-teal-400 bg-teal-500/10'
                  : 'border-border hover:border-teal-500/30 hover:bg-muted/50'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleFiles(e.target.files)
                  e.target.value = '' // reset for re-upload
                }}
              />
              <div className="flex flex-col items-center gap-1.5">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  isDragOver ? 'bg-teal-500/20' : 'bg-muted'
                )}>
                  <ImagePlus className={cn(
                    'w-5 h-5',
                    isDragOver ? 'text-teal-400' : 'text-muted-foreground'
                  )} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {isDragOver ? 'Drop images here' : 'Drag & drop or click to browse'}
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  JPG, PNG up to 10MB · {images.length}/{maxImages} images
                </p>
              </div>
            </div>
          )}

          {/* Thumbnail strip */}
          {images.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-border group"
                >
                  <img
                    src={img.previewUrl}
                    alt={img.description}
                    className="w-full h-full object-cover"
                  />

                  {/* Status overlay */}
                  {img.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                  {img.status === 'error' && (
                    <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    </div>
                  )}
                  {img.status === 'done' && (
                    <div className="absolute top-1 left-1">
                      <CheckCircle className="w-3.5 h-3.5 text-green-400 drop-shadow" />
                    </div>
                  )}

                  {/* Type badge */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                    <span className="text-[9px] text-white truncate block">{img.fileType}</span>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeImage(img.id)
                    }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
