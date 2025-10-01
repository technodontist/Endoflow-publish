'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser } from './auth'

export interface FileUploadData {
  patientId: string
  fileType: string
  description: string
  file: File
}

export interface UploadedFileData {
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
  createdAt: string
}

export async function uploadPatientFileAction(formData: FormData) {
  try {
    // Get current user and verify permissions
    const user = await getCurrentUser()
    if (!user || !['assistant', 'dentist'].includes(user.role)) {
      return { success: false, error: 'Unauthorized: Only staff can upload files' }
    }

    // Extract form data
    const patientId = formData.get('patientId') as string
    const fileType = formData.get('fileType') as string
    const description = formData.get('description') as string
    const file = formData.get('file') as File

    if (!patientId || !fileType || !description || !file) {
      return { success: false, error: 'Missing required fields' }
    }

    // Validate file type (only images allowed)
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'Only image files are allowed' }
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return { success: false, error: 'File size must be less than 10MB' }
    }

    // Create service client for storage operations
    const supabase = await createServiceClient()

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const uniqueFileName = `patient-${patientId}-${timestamp}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`
    const filePath = `patient-files/${patientId}/${uniqueFileName}`

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('medical-files')
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)

      // If storage bucket doesn't exist, provide helpful error message
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('The specified bucket does not exist')) {
        return {
          success: false,
          error: 'Storage bucket not configured. Please create "medical-files" bucket in Supabase Dashboard > Storage.'
        }
      }

      // If policy issues, provide helpful message
      if (uploadError.message?.includes('policy') || uploadError.message?.includes('permission') || uploadError.message?.includes('denied')) {
        return {
          success: false,
          error: 'Storage access denied. The bucket exists but policies need to be configured. Run STORAGE_SETUP_NO_PERMS.sql in Supabase SQL Editor.'
        }
      }

      return { success: false, error: `Failed to upload file to storage: ${uploadError.message}` }
    }

    // Save file metadata to database
    const { data: fileRecord, error: dbError } = await supabase
      .schema('api')
      .from('patient_files')
      .insert({
        patient_id: patientId,
        uploaded_by: user.id,
        file_name: uniqueFileName,
        original_file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        file_type: fileType,
        description: description
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)

      // Clean up uploaded file if database insert fails
      await supabase.storage
        .from('medical-files')
        .remove([filePath])

      return { success: false, error: 'Failed to save file metadata' }
    }

    // Revalidate relevant pages
    revalidatePath('/assistant/files')
    revalidatePath('/patient')
    revalidatePath('/dentist')

    return {
      success: true,
      data: fileRecord,
      message: 'File uploaded successfully'
    }

  } catch (error) {
    console.error('File upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export async function getPatientFilesAction(patientId: string) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Verify user can access this patient's files
    if (user.role === 'patient' && user.id !== patientId) {
      return { success: false, error: 'Access denied' }
    }

    const supabase = await createServiceClient()

    const { data: files, error } = await supabase
      .schema('api')
      .from('patient_files')
      .select('*')
      .eq('patient_id', patientId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching patient files:', error)
      // If table doesn't exist yet, return empty array instead of error
      if (error.message.includes('patient_files') || error.code === 'PGRST106') {
        return { success: true, data: [] }
      }
      return { success: false, error: 'Failed to fetch patient files' }
    }

    // Get uploader information separately since we can't rely on foreign key relationships yet
    let uploaderData: any[] = []
    if (files && files.length > 0) {
      const uploaderIds = [...new Set(files.map(f => f.uploaded_by).filter(Boolean))]
      if (uploaderIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', uploaderIds)
        
        if (!profilesError && profiles) {
          uploaderData = profiles
        }
      }
    }

    // Map uploader information to files and convert field names to camelCase
    const filesWithUploaders = files?.map(file => {
      const uploader = uploaderData.find(u => u.id === file.uploaded_by)
      return {
        id: file.id,
        patientId: file.patient_id,
        uploadedBy: file.uploaded_by,
        fileName: file.file_name,
        originalFileName: file.original_file_name,
        filePath: file.file_path,
        fileSize: file.file_size,
        mimeType: file.mime_type,
        fileType: file.file_type,
        description: file.description,
        isArchived: file.is_archived,
        createdAt: file.created_at,
        updatedAt: file.updated_at,
        uploader: uploader ? { id: uploader.id, full_name: uploader.full_name } : null
      }
    }) || []

    return {
      success: true,
      data: filesWithUploaders
    }

  } catch (error) {
    console.error('Error in getPatientFilesAction:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export async function getFileUrlAction(filePath: string) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createServiceClient()

    // Get signed URL for secure file access
    const { data: urlData, error } = await supabase.storage
      .from('medical-files')
      .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (error) {
      console.error('Error creating signed URL:', error)
      return { success: false, error: 'Failed to generate file URL' }
    }

    return {
      success: true,
      url: urlData.signedUrl
    }

  } catch (error) {
    console.error('Error in getFileUrlAction:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

export async function deletePatientFileAction(fileId: string) {
  try {
    const user = await getCurrentUser()
    if (!user || !['assistant', 'dentist'].includes(user.role)) {
      return { success: false, error: 'Unauthorized: Only staff can delete files' }
    }

    const supabase = await createServiceClient()

    // Get file info before deletion
    const { data: fileInfo, error: fetchError } = await supabase
      .schema('api')
      .from('patient_files')
      .select('file_path')
      .eq('id', fileId)
      .single()

    if (fetchError || !fileInfo) {
      return { success: false, error: 'File not found' }
    }

    // Archive the file instead of hard delete
    const { error: updateError } = await supabase
      .schema('api')
      .from('patient_files')
      .update({ is_archived: true })
      .eq('id', fileId)

    if (updateError) {
      console.error('Error archiving file:', updateError)
      return { success: false, error: 'Failed to archive file' }
    }

    // Optionally remove from storage (uncomment if you want hard delete)
    // await supabase.storage
    //   .from('medical-files')
    //   .remove([fileInfo.file_path])

    // Revalidate relevant pages
    revalidatePath('/assistant/files')
    revalidatePath('/patient')
    revalidatePath('/dentist')

    return {
      success: true,
      message: 'File archived successfully'
    }

  } catch (error) {
    console.error('Error in deletePatientFileAction:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}