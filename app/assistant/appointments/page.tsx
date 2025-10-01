import { EnhancedAssistantAppointmentOrganizer } from '@/components/assistant/enhanced-appointment-organizer'
import { getCurrentUser } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'

export default async function AssistantAppointmentsPage() {
  const user = await getCurrentUser()

  if (!user || user.role !== 'assistant') {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <EnhancedAssistantAppointmentOrganizer currentAssistantId={user.id} />
      </div>
    </div>
  )
}
