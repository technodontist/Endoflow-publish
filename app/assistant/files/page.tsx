import { getCurrentUser } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import { FileUploaderInterface } from '@/components/assistant/file-uploader-interface'

export default async function AssistantFilesPage() {
  const user = await getCurrentUser()

  if (!user || user.role !== 'assistant') {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FileUploaderInterface currentAssistantId={user.id} />
    </div>
  )
}