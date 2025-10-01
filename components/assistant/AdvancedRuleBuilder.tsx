'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Users, Search, Filter } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'

// Types for the rule builder
interface Condition {
  id: string
  field: string
  operator: string
  value: string
}

interface Group {
  id: string
  name: string
  description: string
  conditions: Condition[]
}

interface FilterRules {
  groups: Group[]
}

// Available fields for filtering
const FILTER_FIELDS = [
  // Patient Demographics
  { value: 'patient_age', label: 'Patient Age', category: 'Demographics' },
  { value: 'patient_gender', label: 'Patient Gender', category: 'Demographics' },
  { value: 'registration_date', label: 'Registration Date', category: 'Demographics' },

  // Clinical Data - Chief Complaint
  { value: 'clinical_data.chief_complaint', label: 'Chief Complaint', category: 'Clinical' },

  // Clinical Data - Diagnosis
  { value: 'clinical_data.diagnosis.primary', label: 'Primary Diagnosis', category: 'Diagnosis' },
  { value: 'clinical_data.diagnosis.secondary', label: 'Secondary Diagnosis', category: 'Diagnosis' },
  { value: 'clinical_data.diagnosis.tooth_number', label: 'Affected Tooth Number', category: 'Diagnosis' },

  // Clinical Data - Symptoms
  { value: 'clinical_data.symptoms.pain_level', label: 'Pain Level (1-10)', category: 'Symptoms' },
  { value: 'clinical_data.symptoms.pain_type', label: 'Pain Type', category: 'Symptoms' },
  { value: 'clinical_data.symptoms.duration', label: 'Symptom Duration', category: 'Symptoms' },

  // Clinical Data - Treatment
  { value: 'clinical_data.treatment_plan.recommended', label: 'Recommended Treatment', category: 'Treatment' },
  { value: 'clinical_data.treatment_plan.urgency', label: 'Treatment Urgency', category: 'Treatment' },
  { value: 'clinical_data.treatment_plan.complexity', label: 'Treatment Complexity', category: 'Treatment' },

  // Clinical Data - Medical History
  { value: 'clinical_data.patient_info.medical_history', label: 'Medical History Conditions', category: 'Medical History' },
  { value: 'clinical_data.patient_info.medications', label: 'Current Medications', category: 'Medical History' },
  { value: 'clinical_data.patient_info.allergies', label: 'Allergies', category: 'Medical History' },

  // Clinical Data - Examination
  { value: 'clinical_data.examination.clinical_findings', label: 'Clinical Findings', category: 'Examination' },
  { value: 'clinical_data.examination.radiographic_findings', label: 'Radiographic Findings', category: 'Examination' },

  // Appointment Data
  { value: 'appointment_count', label: 'Total Appointments', category: 'Appointments' },
  { value: 'last_appointment_date', label: 'Last Appointment Date', category: 'Appointments' },
]

// Operators for different field types
const OPERATORS = [
  { value: 'equals', label: 'Equals', types: ['text', 'number', 'select'] },
  { value: 'not_equals', label: 'Not Equals', types: ['text', 'number', 'select'] },
  { value: 'contains', label: 'Contains', types: ['text'] },
  { value: 'not_contains', label: 'Does Not Contain', types: ['text'] },
  { value: 'greater_than', label: 'Greater Than', types: ['number', 'date'] },
  { value: 'less_than', label: 'Less Than', types: ['number', 'date'] },
  { value: 'greater_than_or_equal', label: 'Greater Than or Equal', types: ['number', 'date'] },
  { value: 'less_than_or_equal', label: 'Less Than or Equal', types: ['number', 'date'] },
  { value: 'in_array', label: 'In List', types: ['array'] },
  { value: 'not_in_array', label: 'Not In List', types: ['array'] },
  { value: 'is_null', label: 'Is Empty', types: ['text', 'number'] },
  { value: 'is_not_null', label: 'Is Not Empty', types: ['text', 'number'] },
]

interface AdvancedRuleBuilderProps {
  initialRules?: FilterRules
  onRulesChange: (rules: FilterRules) => void
  onRunQuery: (rules: FilterRules) => Promise<void>
  isLoading?: boolean
}

export default function AdvancedRuleBuilder({
  initialRules,
  onRulesChange,
  onRunQuery,
  isLoading = false
}: AdvancedRuleBuilderProps) {
  const [filterRules, setFilterRules] = useState<FilterRules>(
    initialRules || { groups: [] }
  )

  // Generate unique IDs
  const generateId = () => Math.random().toString(36).substr(2, 9)

  // Update rules and notify parent
  const updateRules = useCallback((newRules: FilterRules) => {
    setFilterRules(newRules)
    onRulesChange(newRules)
  }, [onRulesChange])

  // Add new group
  const addGroup = () => {
    const newGroup: Group = {
      id: generateId(),
      name: `Group ${filterRules.groups.length + 1}`,
      description: '',
      conditions: []
    }
    updateRules({
      ...filterRules,
      groups: [...filterRules.groups, newGroup]
    })
  }

  // Remove group
  const removeGroup = (groupId: string) => {
    updateRules({
      ...filterRules,
      groups: filterRules.groups.filter(g => g.id !== groupId)
    })
  }

  // Update group
  const updateGroup = (groupId: string, updates: Partial<Group>) => {
    updateRules({
      ...filterRules,
      groups: filterRules.groups.map(g =>
        g.id === groupId ? { ...g, ...updates } : g
      )
    })
  }

  // Add condition to group
  const addCondition = (groupId: string) => {
    const newCondition: Condition = {
      id: generateId(),
      field: '',
      operator: '',
      value: ''
    }
    updateRules({
      ...filterRules,
      groups: filterRules.groups.map(g =>
        g.id === groupId
          ? { ...g, conditions: [...g.conditions, newCondition] }
          : g
      )
    })
  }

  // Remove condition
  const removeCondition = (groupId: string, conditionId: string) => {
    updateRules({
      ...filterRules,
      groups: filterRules.groups.map(g =>
        g.id === groupId
          ? { ...g, conditions: g.conditions.filter(c => c.id !== conditionId) }
          : g
      )
    })
  }

  // Update condition
  const updateCondition = (groupId: string, conditionId: string, updates: Partial<Condition>) => {
    updateRules({
      ...filterRules,
      groups: filterRules.groups.map(g =>
        g.id === groupId
          ? {
              ...g,
              conditions: g.conditions.map(c =>
                c.id === conditionId ? { ...c, ...updates } : c
              )
            }
          : g
      )
    })
  }

  // Get field type for operator filtering
  const getFieldType = (fieldValue: string): string => {
    if (fieldValue.includes('age') || fieldValue.includes('pain_level') || fieldValue.includes('count')) {
      return 'number'
    }
    if (fieldValue.includes('date')) {
      return 'date'
    }
    if (fieldValue.includes('medical_history') || fieldValue.includes('medications') || fieldValue.includes('allergies')) {
      return 'array'
    }
    return 'text'
  }

  // Group fields by category
  const groupedFields = FILTER_FIELDS.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = []
    }
    acc[field.category].push(field)
    return acc
  }, {} as Record<string, typeof FILTER_FIELDS>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Advanced Research Query Builder</h3>
        </div>
        <Button onClick={addGroup} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Group
        </Button>
      </div>

      {filterRules.groups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">No Research Groups Created</h4>
            <p className="text-muted-foreground mb-4">
              Create groups to define patient cohorts for comparative analysis
            </p>
            <Button onClick={addGroup}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filterRules.groups.map((group, groupIndex) => (
            <Card key={group.id}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Group {groupIndex + 1}</Badge>
                      <Input
                        value={group.name}
                        onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                        placeholder="Group Name (e.g., Group A: Endodontic Cases)"
                        className="flex-1"
                      />
                    </div>
                    <Textarea
                      value={group.description}
                      onChange={(e) => updateGroup(group.id, { description: e.target.value })}
                      placeholder="Optional description of this patient group..."
                      className="text-sm"
                      rows={2}
                    />
                  </div>
                  <Button
                    onClick={() => removeGroup(group.id)}
                    variant="ghost"
                    size="sm"
                    className="ml-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Filter Conditions {group.conditions.length > 0 && `(${group.conditions.length})`}
                  </Label>
                  <Button
                    onClick={() => addCondition(group.id)}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Condition
                  </Button>
                </div>

                {group.conditions.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>No conditions set. Add conditions to filter patients.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {group.conditions.map((condition, conditionIndex) => (
                      <div key={condition.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          {/* Field Selection */}
                          <div>
                            <Label className="text-xs text-muted-foreground">Field</Label>
                            <Select
                              value={condition.field}
                              onValueChange={(value) =>
                                updateCondition(group.id, condition.id, {
                                  field: value,
                                  operator: '', // Reset operator when field changes
                                  value: '' // Reset value when field changes
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select field..." />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(groupedFields).map(([category, fields]) => (
                                  <div key={category}>
                                    <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                                      {category}
                                    </div>
                                    {fields.map((field) => (
                                      <SelectItem key={field.value} value={field.value}>
                                        {field.label}
                                      </SelectItem>
                                    ))}
                                  </div>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Operator Selection */}
                          <div>
                            <Label className="text-xs text-muted-foreground">Operator</Label>
                            <Select
                              value={condition.operator}
                              onValueChange={(value) =>
                                updateCondition(group.id, condition.id, { operator: value })
                              }
                              disabled={!condition.field}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select operator..." />
                              </SelectTrigger>
                              <SelectContent>
                                {OPERATORS
                                  .filter(op =>
                                    op.types.includes(getFieldType(condition.field))
                                  )
                                  .map((operator) => (
                                    <SelectItem key={operator.value} value={operator.value}>
                                      {operator.label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Value Input */}
                          <div>
                            <Label className="text-xs text-muted-foreground">Value</Label>
                            <Input
                              value={condition.value}
                              onChange={(e) =>
                                updateCondition(group.id, condition.id, { value: e.target.value })
                              }
                              placeholder="Enter value..."
                              disabled={!condition.operator || ['is_null', 'is_not_null'].includes(condition.operator)}
                              type={getFieldType(condition.field) === 'number' ? 'number' : 'text'}
                            />
                          </div>
                        </div>

                        <Button
                          onClick={() => removeCondition(group.id, condition.id)}
                          variant="ghost"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Run Query Button */}
      {filterRules.groups.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => onRunQuery(filterRules)}
            disabled={isLoading || filterRules.groups.every(g => g.conditions.length === 0)}
            size="lg"
            className="min-w-[200px]"
          >
            <Search className="h-4 w-4 mr-2" />
            {isLoading ? 'Running Query...' : 'Run Research Query'}
          </Button>
        </div>
      )}

      {/* Debug: Show current rules JSON (remove in production) */}
      {process.env.NODE_ENV === 'development' && filterRules.groups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Query Preview (Development)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded overflow-auto">
              {JSON.stringify(filterRules, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}