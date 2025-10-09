# Add AI Scheduler to Enhanced Appointment Organizer

## Changes Required

### 1. Add imports at the top (after line 54)

```typescript
import AIAppointmentScheduler from './ai-appointment-scheduler'
```

### 2. Add Sparkles icon to imports (line 35)

Change from:
```typescript
  UserCheck,
  Bell
} from "lucide-react"
```

To:
```typescript
  UserCheck,
  Bell,
  Sparkles
} from "lucide-react"
```

### 3. Add state variable (after line 151)

```typescript
  // AI Appointment Scheduler state
  const [showAIScheduler, setShowAIScheduler] = useState(false)
```

### 4. Update button section (around line 696-702)

Replace:
```typescript
              <Button 
                className="bg-teal-600 hover:bg-teal-700"
                onClick={() => setShowContextualForm(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Appointment
              </Button>
```

With:
```typescript
              <div className="flex gap-2">
                <Button 
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" 
                  onClick={() => setShowAIScheduler(true)}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Schedule
                </Button>
                <Button 
                  className="bg-teal-600 hover:bg-teal-700"
                  onClick={() => {
                    setSelectedPatientId('')
                    setShowContextualForm(true)
                  }}
                >
                  <Plus className="w-4 w-4 mr-2" />
                  New Appointment
                </Button>
              </div>
```

### 5. Add AI Scheduler Dialog (before the closing `</div>` and `)` at the end, around line 1497)

Insert before line 1498:
```typescript
      {/* AI Appointment Scheduler Dialog */}
      <Dialog open={showAIScheduler} onOpenChange={setShowAIScheduler}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Appointment Scheduler
            </DialogTitle>
          </DialogHeader>
          <div className="h-[600px]">
            <AIAppointmentScheduler
              dentistId={dentistId}
              onAppointmentCreated={(appointmentId) => {
                console.log('Appointment created:', appointmentId)
                setShowAIScheduler(false)
                loadAppointments()
                onRefreshStats()
                toast.success('Appointment scheduled successfully!')
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
```

## Manual Steps

1. Open `components/dentist/enhanced-appointment-organizer.tsx`
2. Make each change as described above
3. Save the file
4. The AI Scheduler will appear as a purple button next to "New Appointment"

## Expected Result

- A new "AI Schedule" button appears in the appointment organizer header
- Clicking it opens a modal with the AI chat interface
- Users can type natural language commands to schedule appointments
- When appointments are created, the calendar refreshes automatically
