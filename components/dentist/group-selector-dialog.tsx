'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Users } from 'lucide-react'

interface GroupSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (groupName: string) => void
  selectedPatientCount: number
  isLoading?: boolean
}

const PREDEFINED_GROUPS = [
  { value: 'Control', label: 'Control Group', description: 'Standard control group for comparison' },
  { value: 'Treatment A', label: 'Treatment A', description: 'First treatment intervention group' },
  { value: 'Treatment B', label: 'Treatment B', description: 'Second treatment intervention group' },
  { value: 'Single Visit', label: 'Single Visit', description: 'Single-visit treatment protocol' },
  { value: 'Multi-Visit', label: 'Multi-Visit', description: 'Multiple-visit treatment protocol' },
  { value: 'custom', label: 'Custom Group', description: 'Define your own group name' },
]

export function GroupSelectorDialog({
  open,
  onOpenChange,
  onConfirm,
  selectedPatientCount,
  isLoading = false
}: GroupSelectorDialogProps) {
  const [selectedGroup, setSelectedGroup] = useState('Control')
  const [customGroupName, setCustomGroupName] = useState('')

  const handleConfirm = () => {
    const groupName = selectedGroup === 'custom' ? customGroupName.trim() : selectedGroup
    if (!groupName) return
    onConfirm(groupName)
  }

  const isCustomSelected = selectedGroup === 'custom'
  const isValid = isCustomSelected ? customGroupName.trim().length > 0 : true

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            Assign Patients to Group
          </DialogTitle>
          <DialogDescription>
            Select a group to assign {selectedPatientCount} patient{selectedPatientCount !== 1 ? 's' : ''} to your research cohort.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={selectedGroup} onValueChange={setSelectedGroup}>
            <div className="space-y-3">
              {PREDEFINED_GROUPS.map((group) => (
                <div key={group.value} className="flex items-start space-x-3">
                  <RadioGroupItem value={group.value} id={group.value} className="mt-1" />
                  <div className="flex-1 cursor-pointer" onClick={() => setSelectedGroup(group.value)}>
                    <Label
                      htmlFor={group.value}
                      className="font-medium cursor-pointer"
                    >
                      {group.label}
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5">{group.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </RadioGroup>

          {isCustomSelected && (
            <div className="ml-6 space-y-2 pt-2">
              <Label htmlFor="custom-group-name">Custom Group Name</Label>
              <Input
                id="custom-group-name"
                placeholder="Enter group name (e.g., Experimental Protocol A)"
                value={customGroupName}
                onChange={(e) => setCustomGroupName(e.target.value)}
                className="w-full"
                autoFocus
              />
            </div>
          )}

          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm">
            <p className="text-teal-800">
              <strong>Selected:</strong> {selectedPatientCount} patient{selectedPatientCount !== 1 ? 's' : ''} will be added to{' '}
              <strong className="text-teal-900">
                {isCustomSelected ? (customGroupName || 'Custom Group') : selectedGroup}
              </strong>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || isLoading}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {isLoading ? 'Adding...' : 'Add to Cohort'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
