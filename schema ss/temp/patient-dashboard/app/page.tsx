import { PatientDashboard } from "@/components/patient-dashboard"

// Mock patient data for demonstration
const mockPatientData = {
  name: "Sarah Johnson",
  email: "sarah.johnson@email.com",
  phone: "+1 (555) 123-4567",
  avatar: "/professional-woman-smiling.png",
  nextAppointment: {
    date: "March 15, 2024",
    time: "2:30 PM",
    doctor: "Emily Chen",
    type: "Routine Cleaning",
  },
  recentActivity: [
    {
      id: "1",
      type: "appointment",
      description: "Completed routine cleaning with Dr. Chen",
      date: "February 28, 2024",
    },
    {
      id: "2",
      type: "record",
      description: "X-ray results uploaded to your file",
      date: "February 25, 2024",
    },
    {
      id: "3",
      type: "message",
      description: "New message from Dr. Chen about treatment plan",
      date: "February 22, 2024",
    },
  ],
  notifications: 2,
}

export default function HomePage() {
  return <PatientDashboard patientData={mockPatientData} isLoading={false} error={undefined} />
}
