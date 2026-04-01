'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Users,
  Calendar,
  TrendingUp,
  BarChart3,
  Search,
  Trash2,
  Edit,
  CheckCircle,
  Clock,
  XCircle,
  Activity,
  Download,
  RefreshCw,
  AlertCircle,
  Lightbulb,
  Filter
} from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

// Import our custom actions and utilities
import {
  createResearchProjectAction,
  getResearchProjectsAction,
  updateResearchProjectAction,
  deleteResearchProjectAction,
  findMatchingPatientsAction,
  getProjectAnalyticsAction,
  addPatientToCohortAction,
  removePatientFromCohortAction,
  getCohortPatientsAction,
  updateProjectStatusAction,
  // exportResearchDataAction,
  queryAIResearchAssistantAction,
  type CreateProjectData,
  type FilterCriteria
} from '@/lib/actions/research-projects'
import { getActivePatientsAction } from '@/lib/actions/appointments'

import {
  PATIENT_FILTER_FIELDS,
  validateFilterCriteria,
  describeCriteria,
  getOperatorsForDataType,
  type FilterField
} from '@/lib/utils/filter-engine'
import { JSONB_FILTER_CATEGORIES, isJSONBField } from '@/lib/utils/jsonb-query-builder'
import ResearchAIAssistant from './research-ai-assistant'
import { GroupSelectorDialog } from './group-selector-dialog'
import { AIInsightsPanel } from './ai-insights-panel'
import { generateEnhancedAnalytics, type EnhancedAnalytics } from '@/lib/services/ai-enhanced-analytics'
import { NLFilterInput } from './nl-filter-input'

interface ResearchProject {
  id: string
  name: string
  description: string
  hypothesis?: string
  status: 'draft' | 'active' | 'completed' | 'paused'
  startDate: Date
  endDate?: Date
  tags: string[]
  patientCount: number
  createdAt: Date
}

interface MatchingPatient {
  id: string
  firstName: string
  lastName: string
  age: number
  gender: string
  lastVisit: Date
  condition?: string
  matchScore: number
}

interface ProjectAnalytics {
  totalPatients: number
  averageAge: number
  ageStats: {
    mean: number
    mode: number
    sd: number
    ci95Lower: number
    ci95Upper: number
    min: number
    max: number
  }
  ageDistribution: { range: string; count: number; fill: string }[]
  genderDistribution: { name: string; value: number; fill: string }[]
  conditionDistribution: { name: string; value: number; fill: string }[]
  outcomeDistribution: { name: string; value: number; fill: string }[]
  treatmentComparison: { treatment: string; successRate: number }[]
  healingTimeComparison: { protocol: string; avgDays: number }[]
  treatmentSuccess?: number
  followUpRate?: number
  monthlyProgress?: { month: string; patients: number; outcomes: number }[]
}

export function ResearchProjects() {
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<'projects' | 'definition' | 'matching'>('projects')

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Project Management State
  const [projects, setProjects] = useState<ResearchProject[]>([])
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [missingTables, setMissingTables] = useState(false)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isEditingProject, setIsEditingProject] = useState(false)
  const [projectFormData, setProjectFormData] = useState<CreateProjectData>({
    name: '',
    description: '',
    hypothesis: '',
    startDate: new Date(),
    endDate: undefined,
    status: 'draft',
    tags: []
  })

  // Filter and Cohort State
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria[]>([{
    field: 'age',
    operator: 'greater_than',
    value: 18,
    dataType: 'number',
    logicalOperator: 'AND'
  }])
  const [matchingPatients, setMatchingPatients] = useState<MatchingPatient[]>([])
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set())
  const [isLoadingPatients, setIsLoadingPatients] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Analytics State
  const [projectAnalytics, setProjectAnalytics] = useState<ProjectAnalytics | null>(null)
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)
  const [enhancedAnalytics, setEnhancedAnalytics] = useState<EnhancedAnalytics | null>(null)
  const [isLoadingEnhancedAnalytics, setIsLoadingEnhancedAnalytics] = useState(false)

  // Cohort Members State
  const [cohortPatients, setCohortPatients] = useState<any[]>([])
  const [isLoadingCohort, setIsLoadingCohort] = useState(false)

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Group Selector Dialog State
  const [showGroupSelector, setShowGroupSelector] = useState(false)
  const [isAddingToCohort, setIsAddingToCohort] = useState(false)

  // AI Assistant State

  // Define callbacks first before using them in useEffect
  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true)
    setProjectsError(null)
    setMissingTables(false)
    setSetupMessage(null)

    try {
      const result = await getResearchProjectsAction()

      if (result.success && result.projects) {
        setProjects(result.projects)
        console.log('✅ [RESEARCH UI] Loaded', result.projects.length, 'research projects')
      } else if (result.missingTables) {
        setMissingTables(true)
        setSetupMessage(result.setupMessage || 'Research system not set up')
        setProjectsError(result.error || 'Research tables missing')
        console.log('⚠️ [RESEARCH UI] Research tables not found, showing setup guide')
      } else {
        setProjectsError(result.error || 'Failed to load projects')
        console.error('❌ [RESEARCH UI] Failed to load projects:', result.error)
      }
    } catch (error) {
      setProjectsError('Unexpected error loading projects')
      console.error('❌ [RESEARCH UI] Unexpected error:', error)
    } finally {
      setIsLoadingProjects(false)
    }
  }, [])

  const loadProjectAnalytics = useCallback(async (projectId: string) => {
    setIsLoadingAnalytics(true)
    try {
      const result = await getProjectAnalyticsAction(projectId)
      if (result.success) {
        setProjectAnalytics(result.analytics)
      }
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setIsLoadingAnalytics(false)
    }
  }, [])

  const loadEnhancedAnalytics = useCallback(async (projectId: string) => {
    setIsLoadingEnhancedAnalytics(true)
    try {
      console.log('🤖 [RESEARCH UI] Loading AI-enhanced analytics for project:', projectId)
      // Get cohort patients for analysis
      const cohortResult = await getCohortPatientsAction(projectId)
      if (cohortResult.success && cohortResult.patients && cohortResult.patients.length > 0) {
        console.log(`🤖 [RESEARCH UI] Generating AI insights for ${cohortResult.patients.length} patients`)
        const analytics = await generateEnhancedAnalytics(cohortResult.patients, projectId)
        setEnhancedAnalytics(analytics)
        console.log('✅ [RESEARCH UI] AI-enhanced analytics generated successfully')
      } else {
        console.log('⚠️ [RESEARCH UI] No cohort data available for AI analysis')
        setEnhancedAnalytics(null)
      }
    } catch (error) {
      console.error('❌ [RESEARCH UI] Failed to load enhanced analytics:', error)
      setEnhancedAnalytics(null)
    } finally {
      setIsLoadingEnhancedAnalytics(false)
    }
  }, [])

  const loadCohortPatients = useCallback(async (projectId: string) => {
    setIsLoadingCohort(true)
    try {
      console.log('👥 [RESEARCH UI] Loading cohort patients for project:', projectId)
      const result = await getCohortPatientsAction(projectId)
      if (result.success && result.patients) {
        setCohortPatients(result.patients)
        console.log(`✅ [RESEARCH UI] Loaded ${result.patients.length} cohort patients`)
      } else {
        console.error('Failed to load cohort patients:', result.error)
        setCohortPatients([])
      }
    } catch (error) {
      console.error('Error loading cohort patients:', error)
      setCohortPatients([])
    } finally {
      setIsLoadingCohort(false)
    }
  }, [])

  const handleFindMatchingPatients = useCallback(async () => {
    setIsLoadingPatients(true)
    try {
      console.log('🔬 [RESEARCH UI] Starting patient search with criteria:', filterCriteria)

      // Use the simplified research-specific patient search
      const result = await findMatchingPatientsAction(filterCriteria)
      console.log('🔬 [RESEARCH UI] Patient search result:', result)

      if (result.success && result.patients) {
        setMatchingPatients(result.patients)
        console.log(`🔬 [RESEARCH UI] Successfully loaded ${result.patients.length} matching patients`)
      } else {
        console.error('🔬 [RESEARCH UI] Search failed:', result.error || 'No data returned')
        setMatchingPatients([])
      }
    } catch (error) {
      console.error('❌ [RESEARCH UI] Failed to find matching patients:', error)
      setMatchingPatients([])
    } finally {
      setIsLoadingPatients(false)
    }
  }, [filterCriteria])

  // Load projects on component mount
  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // ✅ FIX: Debounced patient matching - prevent execution on every keystroke
  useEffect(() => {
    console.log('🔬 [RESEARCH UI] Filter criteria changed, scheduling debounced search...')

    // Debounce: wait 800ms after user stops typing/changing filters
    const timeoutId = setTimeout(() => {
      console.log('🔬 [RESEARCH UI] Executing debounced patient search')
      handleFindMatchingPatients()
    }, 800)

    // Cleanup: cancel the timeout if criteria changes again before 800ms
    return () => {
      console.log('🔬 [RESEARCH UI] Cancelling previous search timeout')
      clearTimeout(timeoutId)
    }
  }, [filterCriteria, handleFindMatchingPatients]) // Re-run when filter criteria changes

  // Load analytics and cohort when project is selected
  useEffect(() => {
    if (selectedProject && !isCreatingProject && !isEditingProject) {
      loadProjectAnalytics(selectedProject)
      loadCohortPatients(selectedProject)
      loadEnhancedAnalytics(selectedProject)
    }
  }, [selectedProject, isCreatingProject, isEditingProject, loadProjectAnalytics, loadCohortPatients, loadEnhancedAnalytics])

  const handleCreateProject = useCallback(() => {
    setIsCreatingProject(true)
    setIsEditingProject(false)
    setSelectedProject(null)
    setProjectFormData({
      name: '',
      description: '',
      hypothesis: '',
      startDate: new Date(),
      endDate: undefined,
      status: 'draft',
      tags: []
    })
    setFilterCriteria([{
      field: 'age',
      operator: 'greater_than',
      value: 18,
      dataType: 'number',
      logicalOperator: 'AND'
    }])
  }, [])

  const handleSelectProject = useCallback((projectId: string) => {
    setSelectedProject(projectId)
    setIsCreatingProject(false)
    setIsEditingProject(false)
  }, [])

  const handleEditProject = useCallback((projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const project = projects.find(p => p.id === projectId)
    if (project) {
      setSelectedProject(projectId)
      setIsEditingProject(true)
      setIsCreatingProject(false)
      setProjectFormData({
        name: project.name,
        description: project.description,
        hypothesis: project.hypothesis,
        startDate: project.startDate,
        endDate: project.endDate,
        status: project.status,
        tags: project.tags
      })
    }
  }, [projects])

  const handleSaveProject = useCallback(async () => {
    try {
      console.log('🔬 [RESEARCH UI] Saving project:', projectFormData.name)

      // Add the current filter criteria to the project data
      const projectData = {
        ...projectFormData,
        filterCriteria: filterCriteria
      }

      if (isEditingProject && selectedProject) {
        console.log('🔬 [RESEARCH UI] Updating existing project:', selectedProject)
        const result = await updateResearchProjectAction(selectedProject, projectData)
        if (result.success) {
          console.log('✅ [RESEARCH UI] Project updated successfully')
          await loadProjects()
          setIsEditingProject(false)
          setSelectedProject(result.project?.id || selectedProject)
        } else {
          console.error('❌ [RESEARCH UI] Failed to update project:', result.error)
        }
      } else {
        console.log('🔬 [RESEARCH UI] Creating new project')
        const result = await createResearchProjectAction(projectData)
        if (result.success) {
          console.log('✅ [RESEARCH UI] Project created successfully:', result.project?.id)
          await loadProjects()
          setIsCreatingProject(false)
          setSelectedProject(result.project?.id)
        } else {
          console.error('❌ [RESEARCH UI] Failed to create project:', result.error)
        }
      }
    } catch (error) {
      console.error('❌ [RESEARCH UI] Exception saving project:', error)
    }
  }, [isEditingProject, selectedProject, projectFormData, filterCriteria, loadProjects])

  const handleUpdateProjectStatus = useCallback(async (status: 'draft' | 'active' | 'completed' | 'paused') => {
    if (!selectedProject) return

    console.log('🔄 [RESEARCH UI] Updating project status:', { selectedProject, status })
    try {
      const result = await updateProjectStatusAction(selectedProject, status)
      if (result.success) {
        console.log('✅ [RESEARCH UI] Project status updated successfully')
        await loadProjects()
      } else {
        console.error('❌ [RESEARCH UI] Failed to update project status:', result.error)
      }
    } catch (error) {
      console.error('❌ [RESEARCH UI] Exception updating project status:', error)
    }
  }, [selectedProject, loadProjects])

  const handleDeleteClick = useCallback((projectId: string, projectName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setProjectToDelete({ id: projectId, name: projectName })
    setDeleteDialogOpen(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!projectToDelete) return

    setIsDeleting(true)
    console.log('🗑️ [RESEARCH UI] Deleting project:', projectToDelete.id)

    try {
      const result = await deleteResearchProjectAction(projectToDelete.id)
      if (result.success) {
        console.log('✅ [RESEARCH UI] Project deleted successfully')

        // Clear selection if deleted project was selected
        if (selectedProject === projectToDelete.id) {
          setSelectedProject(null)
          setIsCreatingProject(false)
          setIsEditingProject(false)
        }

        // Reload projects
        await loadProjects()

        // Close dialog
        setDeleteDialogOpen(false)
        setProjectToDelete(null)

        alert(`✅ Successfully deleted project "${projectToDelete.name}"`)
      } else {
        console.error('❌ [RESEARCH UI] Failed to delete project:', result.error)
        alert(`❌ Failed to delete project: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ [RESEARCH UI] Exception deleting project:', error)
      alert('❌ An error occurred while deleting the project')
    } finally {
      setIsDeleting(false)
    }
  }, [projectToDelete, selectedProject, loadProjects])


  const addFilterCriteria = useCallback(() => {
    setFilterCriteria(prev => [...prev, {
      field: 'age',
      operator: 'equals',
      value: '',
      dataType: 'number',
      logicalOperator: 'AND'
    }])
  }, [])

  const updateFilterCriteria = useCallback((index: number, updates: Partial<FilterCriteria>) => {
    setFilterCriteria(prev => prev.map((criteria, i) =>
      i === index ? { ...criteria, ...updates } : criteria
    ))
  }, [])

  const removeFilterCriteria = useCallback((index: number) => {
    setFilterCriteria(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Filter patients based on search query
  const filteredPatients = useMemo(() => {
    return matchingPatients.filter(patient => {
      const searchLower = searchQuery.toLowerCase()
      return (
        patient.firstName.toLowerCase().includes(searchLower) ||
        patient.lastName.toLowerCase().includes(searchLower) ||
        patient.id.toLowerCase().includes(searchLower)
      )
    })
  }, [matchingPatients, searchQuery])

  // Patient Selection Handlers
  const handlePatientToggle = useCallback((patientId: string) => {
    setSelectedPatients(prev => {
      const newSet = new Set(prev)
      if (newSet.has(patientId)) {
        newSet.delete(patientId)
      } else {
        newSet.add(patientId)
      }
      return newSet
    })
  }, [])

  const handleSelectAllPatients = useCallback(() => {
    setSelectedPatients(new Set(filteredPatients.map(p => p.id)))
  }, [filteredPatients])

  const handleDeselectAllPatients = useCallback(() => {
    setSelectedPatients(new Set())
  }, [])

  const handleAddSelectedToCohort = useCallback(async () => {
    if (!selectedProject || selectedPatients.size === 0) return
    // Open group selector dialog
    setShowGroupSelector(true)
  }, [selectedProject, selectedPatients])

  const handleGroupSelected = useCallback(async (groupName: string) => {
    if (!selectedProject || selectedPatients.size === 0) return

    console.log('👥 [RESEARCH UI] Adding selected patients to cohort:', {
      projectId: selectedProject,
      patientCount: selectedPatients.size,
      groupName
    })

    setIsAddingToCohort(true)

    try {
      let successCount = 0
      let errorCount = 0

      // Add each selected patient to the cohort
      for (const patientId of Array.from(selectedPatients)) {
        const result = await addPatientToCohortAction(selectedProject, patientId, groupName)
        if (result.success) {
          successCount++
        } else {
          errorCount++
          console.error('Failed to add patient:', patientId, result.error)
        }
      }

      if (successCount > 0) {
        alert(`✅ Successfully added ${successCount} patient(s) to ${groupName} group!\n${errorCount > 0 ? `\n⚠️ ${errorCount} patient(s) failed to add.` : ''}`)
        setSelectedPatients(new Set())
        setShowGroupSelector(false)
        // Refresh project data and cohort
        await loadProjects()
        if (selectedProject) {
          await loadCohortPatients(selectedProject)
        }
      } else {
        alert(`❌ Failed to add patients to cohort. Please try again.`)
      }
    } catch (error) {
      console.error('Error adding patients to cohort:', error)
      alert('❌ An error occurred while adding patients to cohort.')
    } finally {
      setIsAddingToCohort(false)
    }
  }, [selectedProject, selectedPatients, loadProjects, loadCohortPatients])

  const handleRemoveFromCohort = useCallback(async (patientId: string) => {
    if (!selectedProject) return

    const confirmed = confirm('Are you sure you want to remove this patient from the cohort?')
    if (!confirmed) return

    console.log('👥 [RESEARCH UI] Removing patient from cohort:', { projectId: selectedProject, patientId })

    try {
      const result = await removePatientFromCohortAction(selectedProject, patientId)
      if (result.success) {
        alert('✅ Patient removed from cohort successfully!')
        // Refresh project data and cohort
        await loadProjects()
        await loadCohortPatients(selectedProject)
      } else {
        alert(`❌ Failed to remove patient: ${result.error}`)
      }
    } catch (error) {
      console.error('Error removing patient from cohort:', error)
      alert('❌ An error occurred while removing patient from cohort.')
    }
  }, [selectedProject])

  const currentProject = useMemo(() => {
    return projects.find(p => p.id === selectedProject)
  }, [projects, selectedProject])

  // ENDOFLOW color theme
  const COLORS = {
    primary: '#009688',
    secondary: '#005A9C',
    accent: '#F59E0B',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444'
  }

  return (
    <div className="h-screen flex flex-col bg-muted">
      {/* Header with Save Button */}
      {(isCreatingProject || isEditingProject) && (
        <div className="p-4 border-b bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {isEditingProject ? 'Edit Research Project' : 'Create New Research Project'}
              </h3>
              <p className="text-sm text-muted-foreground">
                Define your research parameters and patient cohort criteria
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreatingProject(false)
                  setIsEditingProject(false)
                  setSelectedProject(null)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveProject}
                disabled={!projectFormData.name.trim()}
                style={{ backgroundColor: COLORS.primary }}
                className="text-white hover:opacity-90"
              >
                {isEditingProject ? 'Update Project' : 'Save Project'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Header */}
      <div className="p-3 md:p-6 border-b bg-card">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xl md:text-3xl font-bold truncate" style={{ color: COLORS.primary }}>
              Research Projects
            </h2>
            <p className="text-muted-foreground mt-1 text-xs md:text-base hidden md:block">
              Manage clinical research initiatives and analyze patient cohorts with AI-powered insights
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline" className="px-2 md:px-3 py-1 text-xs">
              {isLoadingProjects ? (
                <span className="flex items-center">
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  <span className="hidden md:inline">Loading...</span>
                </span>
              ) : missingTables ? (
                <span className="text-yellow-600">Setup</span>
              ) : projectsError ? (
                <span className="text-red-600">Error</span>
              ) : (
                <span>{projects.length} <span className="hidden md:inline">Active </span>Projects</span>
              )}
            </Badge>
          </div>
        </div>
      </div>

      {/* Mobile Panel Switcher */}
      {isMobile && (
        <div className="flex border-b bg-card">
          <button
            onClick={() => setMobilePanel('projects')}
            className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              mobilePanel === 'projects'
                ? 'border-teal-600 text-teal-400 bg-teal-500/10'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            Projects
          </button>
          <button
            onClick={() => setMobilePanel('definition')}
            className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              mobilePanel === 'definition'
                ? 'border-teal-600 text-teal-400 bg-teal-500/10'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            {selectedProject ? 'Cohort' : 'Definition'}
          </button>
          <button
            onClick={() => setMobilePanel('matching')}
            className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              mobilePanel === 'matching'
                ? 'border-teal-600 text-teal-400 bg-teal-500/10'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            {selectedProject ? 'Analytics' : 'Matching'}
          </button>
        </div>
      )}

      {/* 3-Panel Layout: Resizable on desktop, tabbed on mobile */}
      {isMobile && (
        <div className="flex-1 overflow-y-auto" key="mobile-research">
          {/* Mobile: Show one panel at a time */}
          {mobilePanel === 'projects' && (
            <div className="p-3 bg-card min-h-[60vh]">
              <div className="space-y-4">
                <Button
                  className="w-full text-white hover:opacity-90"
                  style={{ backgroundColor: COLORS.primary }}
                  onClick={() => {
                    handleCreateProject()
                    setMobilePanel('definition')
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Research Project
                </Button>

                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : projects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No research projects yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Create your first project above</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        onClick={() => {
                          setSelectedProject(project.id)
                          setMobilePanel('definition')
                        }}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedProject === project.id
                            ? 'border-teal-300 bg-teal-500/10 shadow-sm'
                            : 'border-border hover:border-border hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm text-foreground truncate flex-1">{project.name}</h4>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ml-2 flex-shrink-0 ${
                              project.status === 'active' ? 'bg-green-500/15 text-green-400 border-green-200' :
                              project.status === 'completed' ? 'bg-blue-500/15 text-blue-400 border-blue-200' :
                              project.status === 'paused' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              'bg-muted text-muted-foreground border-border'
                            }`}
                          >
                            {project.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" /> {project.patientCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {new Date(project.startDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {mobilePanel === 'definition' && (
            <div className="p-3 bg-card min-h-[60vh]">
              {isCreatingProject || isEditingProject ? (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold">
                    {isEditingProject ? 'Edit Project' : 'New Research Project'}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-foreground">Project Name *</label>
                      <Input
                        value={projectFormData.name}
                        onChange={(e) => setProjectFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Root Canal Success Rate Analysis"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground">Description</label>
                      <Textarea
                        value={projectFormData.description}
                        onChange={(e) => setProjectFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Brief description of the research objective..."
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground">Hypothesis</label>
                      <Textarea
                        value={projectFormData.hypothesis || ''}
                        onChange={(e) => setProjectFormData(prev => ({ ...prev, hypothesis: e.target.value }))}
                        placeholder="What do you expect to find?"
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setIsCreatingProject(false)
                          setIsEditingProject(false)
                          setMobilePanel('projects')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 text-white"
                        style={{ backgroundColor: COLORS.primary }}
                        onClick={handleSaveProject}
                        disabled={!projectFormData.name.trim()}
                      >
                        {isEditingProject ? 'Update' : 'Create'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : !selectedProject ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-medium">Select a project first</p>
                  <p className="text-xs text-muted-foreground mt-1">Go to Projects tab to select one</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setMobilePanel('projects')}>
                    ← Go to Projects
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Project info header */}
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm text-foreground">
                      {projects.find(p => p.id === selectedProject)?.name || 'Project'}
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {projects.find(p => p.id === selectedProject)?.status}
                    </Badge>
                  </div>
                  {/* Cohort patients count */}
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-sm">Cohort Patients</h4>
                          <p className="text-xs text-muted-foreground mt-1">{cohortPatients.length} patients enrolled</p>
                        </div>
                        <Badge variant="outline">{cohortPatients.length}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                  {/* Cohort patient list */}
                  <div className="space-y-2">
                    {cohortPatients.slice(0, 10).map((patient: any) => (
                      <div key={patient.id} className="p-2 border rounded text-sm flex justify-between items-center">
                        <span className="truncate">{patient.first_name} {patient.last_name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{patient.group || 'No group'}</span>
                      </div>
                    ))}
                    {cohortPatients.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center">+{cohortPatients.length - 10} more patients</p>
                    )}
                    {cohortPatients.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No patients in cohort yet. Use desktop view to add patients.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {mobilePanel === 'matching' && (
            <div className="p-3 bg-card min-h-[60vh]">
              {!selectedProject ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-medium">Select a project first</p>
                  <p className="text-xs text-muted-foreground mt-1">Go to Projects tab to select one</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setMobilePanel('projects')}>
                    ← Go to Projects
                  </Button>
                </div>
              ) : projectAnalytics ? (
                <div className="space-y-4">
                  {/* Analytics Summary Cards */}
                  <div className="grid grid-cols-2 gap-2">
                    <Card><CardContent className="p-3 text-center">
                      <p className="text-lg font-bold" style={{ color: COLORS.primary }}>{projectAnalytics.totalPatients}</p>
                      <p className="text-[10px] text-muted-foreground">Total Patients</p>
                    </CardContent></Card>
                    <Card><CardContent className="p-3 text-center">
                      <p className="text-lg font-bold text-blue-600">{projectAnalytics.meanAge?.toFixed(1) || 'N/A'}</p>
                      <p className="text-[10px] text-muted-foreground">Mean Age</p>
                    </CardContent></Card>
                  </div>
                  {/* Gender Distribution */}
                  {projectAnalytics.genderDistribution && projectAnalytics.genderDistribution.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2 px-3 pt-3">
                        <CardTitle className="text-sm">Gender Distribution</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie data={projectAnalytics.genderDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                              {projectAnalytics.genderDistribution.map((_: any, index: number) => (
                                <Cell key={index} fill={['#0d9488', '#3b82f6', '#f59e0b', '#ef4444'][index % 4]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                  <p className="text-xs text-muted-foreground text-center">View full analytics on desktop</p>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-medium">No analytics available</p>
                  <p className="text-xs text-muted-foreground mt-1">Add patients to the cohort first</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {!isMobile && (
        <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Panel 1: Project List */}
        <ResizablePanel defaultSize={25} minSize={20}>
          <div className="p-4 h-full border-r bg-card">
            <div className="space-y-4">
              <Button
                className="w-full text-white hover:opacity-90"
                style={{ backgroundColor: COLORS.primary }}
                onClick={handleCreateProject}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Project
              </Button>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground flex items-center">
                  <Activity className="w-4 h-4 mr-2" style={{ color: COLORS.primary }} />
                  Your Research Projects
                </h3>

                <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {/* ✅ FIX: Enhanced error handling for project loading */}
                  {isLoadingProjects ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">Loading research projects...</p>
                    </div>
                  ) : missingTables ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-yellow-800">
                            Research System Setup Required
                          </h4>
                          <p className="text-xs text-yellow-700">
                            {setupMessage}
                          </p>
                          <div className="bg-yellow-100 rounded p-3 text-xs text-yellow-800 font-mono">
                            <div className="font-semibold mb-1">Run this SQL in Supabase:</div>
                            CREATE_RESEARCH_TABLES_SIMPLE.sql
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={loadProjects}
                            className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Check Again
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : projectsError ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-start space-x-3">
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-red-800">
                            Failed to Load Projects
                          </h4>
                          <p className="text-xs text-red-700">
                            {projectsError}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={loadProjects}
                            className="text-red-700 border-red-500/40 hover:bg-red-500/20"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Try Again
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Lightbulb className="w-12 h-12 text-gray-300 mb-3" />
                      <h4 className="text-sm font-medium text-foreground mb-1">No Research Projects</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Create your first research project to start analyzing patient data
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCreateProject}
                        className="border-border"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Create Project
                      </Button>
                    </div>
                  ) : (
                    projects.map((project) => (
                      <Card
                        key={project.id}
                        className={`cursor-pointer transition-all hover:shadow-md border ${
                          selectedProject === project.id
                            ? 'ring-2 ring-opacity-50 bg-opacity-5'
                            : 'hover:border-border'
                        }`}
                        style={{
                          ringColor: selectedProject === project.id ? COLORS.primary : undefined,
                          backgroundColor: selectedProject === project.id ? `${COLORS.primary}10` : undefined
                        }}
                        onClick={() => handleSelectProject(project.id)}
                      >
                        <CardHeader className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-sm font-semibold text-foreground truncate">
                                {project.name}
                              </CardTitle>
                              <CardDescription className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {project.description}
                              </CardDescription>
                            </div>
                            <div className="flex gap-1 flex-shrink-0 ml-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-muted"
                                onClick={(e) => handleEditProject(project.id, e)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={(e) => handleDeleteClick(project.id, project.name, e)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Users className="w-3 h-3 mr-1" />
                              {project.patientCount} patients
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-xs px-2 py-1 ${
                                project.status === 'active'
                                  ? 'bg-green-500/15 text-green-400 border-green-200'
                                  : project.status === 'completed'
                                  ? 'bg-blue-500/15 text-blue-400 border-blue-200'
                                  : project.status === 'paused'
                                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                  : 'bg-muted text-foreground border-border'
                              }`}
                            >
                              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                            </Badge>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Panel 2: Dynamic Content (Project Definition or Cohort) */}
        <ResizablePanel defaultSize={40} minSize={30}>
          <div className="p-4 h-full border-r bg-card">
            {isCreatingProject || isEditingProject ? (
              <div className="space-y-6 h-full overflow-y-auto">
                {/* Project Definition */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center" style={{ color: COLORS.primary }}>
                    <Lightbulb className="w-5 h-5 mr-2" />
                    Project Definition
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Project Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        placeholder="Enter research project name"
                        value={projectFormData.name}
                        onChange={(e) => setProjectFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="border-border focus:border-primary focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Description
                      </label>
                      <Textarea
                        placeholder="Describe your research objectives and methodology"
                        value={projectFormData.description}
                        onChange={(e) => setProjectFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className="border-border focus:border-primary focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Research Type
                      </label>
                      <Select
                        value={projectFormData.researchType || ''}
                        onValueChange={(value) => setProjectFormData(prev => ({ ...prev, researchType: value as any }))}
                      >
                        <SelectTrigger className="border-border focus:border-primary focus:ring-primary">
                          <SelectValue placeholder="Select research study design..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cohort">Cohort Study</SelectItem>
                          <SelectItem value="case_control">Case-Control Study</SelectItem>
                          <SelectItem value="rct">Randomized Controlled Trial (RCT)</SelectItem>
                          <SelectItem value="cross_sectional">Cross-Sectional Study</SelectItem>
                          <SelectItem value="longitudinal">Longitudinal Study</SelectItem>
                          <SelectItem value="comparative">Comparative Study</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Choose the study design that best fits your research methodology
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Research Hypothesis (Optional)
                      </label>
                      <Textarea
                        placeholder="State your research hypothesis"
                        value={projectFormData.hypothesis}
                        onChange={(e) => setProjectFormData(prev => ({ ...prev, hypothesis: e.target.value }))}
                        rows={2}
                        className="border-border focus:border-primary focus:ring-primary"
                      />
                    </div>

                    {isEditingProject && (
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-foreground mb-2 block">
                          Project Status
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateProjectStatus('active')}
                            className="bg-green-500/15 text-green-400 hover:bg-green-500/20 border-green-200"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Active
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateProjectStatus('paused')}
                            className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200"
                          >
                            <Clock className="w-4 h-4 mr-1" />
                            Paused
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateProjectStatus('completed')}
                            className="bg-blue-500/15 text-blue-400 hover:bg-blue-500/20 border-blue-200"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Completed
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cohort Definition */}
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center" style={{ color: COLORS.primary }}>
                    <Filter className="w-4 h-4 mr-2" />
                    Define Patient Cohort
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Create filter criteria to automatically identify patients for your research cohort
                  </p>

                  {/* Natural Language Filter Input */}
                  <NLFilterInput
                    onFiltersExtracted={(filters) => {
                      console.log('🎯 [RESEARCH] NL Filters extracted:', filters)
                      // Replace existing filters with AI-extracted ones
                      setFilterCriteria(filters)
                    }}
                    disabled={false}
                  />

                  {/* Manual Filter Option */}
                  <div className="flex items-center gap-2 pt-2">
                    <div className="flex-1 border-t border-border"></div>
                    <span className="text-xs text-muted-foreground px-2">OR CREATE FILTERS MANUALLY</span>
                    <div className="flex-1 border-t border-border"></div>
                  </div>

                  <div className="space-y-3">
                    {filterCriteria.map((criteria, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-end">
                        {index > 0 && (
                          <div className="col-span-2">
                            <Select
                              value={criteria.logicalOperator}
                              onValueChange={(value) => updateFilterCriteria(index, { logicalOperator: value as 'AND' | 'OR' })}
                            >
                              <SelectTrigger className="border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AND">AND</SelectItem>
                                <SelectItem value="OR">OR</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className={index === 0 ? "col-span-4" : "col-span-3"}>
                          <Select
                            value={criteria.field}
                            onValueChange={(value) => {
                              const field = PATIENT_FILTER_FIELDS.find(f => f.key === value)
                              if (field) {
                                updateFilterCriteria(index, {
                                  field: value,
                                  dataType: field.dataType,
                                  operator: field.allowedOperators[0],
                                  value: ''
                                })
                              }
                            }}
                          >
                            <SelectTrigger className="border-border">
                              <SelectValue placeholder="Select filter field..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[400px]">
                              {/* Basic Demographics Section */}
                              <div className="px-2 py-1.5 text-xs font-semibold text-foreground bg-muted sticky top-0">
                                {JSONB_FILTER_CATEGORIES.demographics.icon} {JSONB_FILTER_CATEGORIES.demographics.label}
                              </div>
                              {PATIENT_FILTER_FIELDS.filter(f =>
                                JSONB_FILTER_CATEGORIES.demographics.fields.includes(f.key)
                              ).map((field) => (
                                <SelectItem key={field.key} value={field.key}>
                                  {field.label}
                                </SelectItem>
                              ))}

                              {/* Pain Assessment Section */}
                              <div className="px-2 py-1.5 text-xs font-semibold text-teal-400 bg-teal-500/10 sticky top-0 mt-1">
                                {JSONB_FILTER_CATEGORIES.pain_assessment.icon} {JSONB_FILTER_CATEGORIES.pain_assessment.label}
                              </div>
                              {PATIENT_FILTER_FIELDS.filter(f =>
                                JSONB_FILTER_CATEGORIES.pain_assessment.fields.includes(f.key)
                              ).map((field) => (
                                <SelectItem key={field.key} value={field.key} className="text-teal-400">
                                  {field.label}
                                </SelectItem>
                              ))}

                              {/* Diagnosis Section */}
                              <div className="px-2 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 sticky top-0 mt-1">
                                {JSONB_FILTER_CATEGORIES.diagnosis.icon} {JSONB_FILTER_CATEGORIES.diagnosis.label}
                              </div>
                              {PATIENT_FILTER_FIELDS.filter(f =>
                                JSONB_FILTER_CATEGORIES.diagnosis.fields.includes(f.key)
                              ).map((field) => (
                                <SelectItem key={field.key} value={field.key} className="text-blue-700">
                                  {field.label}
                                </SelectItem>
                              ))}

                              {/* Treatment Plan Section */}
                              <div className="px-2 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 sticky top-0 mt-1">
                                {JSONB_FILTER_CATEGORIES.treatment_plan.icon} {JSONB_FILTER_CATEGORIES.treatment_plan.label}
                              </div>
                              {PATIENT_FILTER_FIELDS.filter(f =>
                                JSONB_FILTER_CATEGORIES.treatment_plan.fields.includes(f.key)
                              ).map((field) => (
                                <SelectItem key={field.key} value={field.key} className="text-purple-700">
                                  {field.label}
                                </SelectItem>
                              ))}

                              {/* FDI Tooth Chart Section */}
                              <div className="px-2 py-1.5 text-xs font-semibold text-green-700 bg-green-50 sticky top-0 mt-1">
                                {JSONB_FILTER_CATEGORIES.fdi_tooth_chart.icon} {JSONB_FILTER_CATEGORIES.fdi_tooth_chart.label}
                              </div>
                              {PATIENT_FILTER_FIELDS.filter(f =>
                                JSONB_FILTER_CATEGORIES.fdi_tooth_chart.fields.includes(f.key)
                              ).map((field) => (
                                <SelectItem key={field.key} value={field.key} className="text-green-700">
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-3">
                          <Select
                            value={criteria.operator}
                            onValueChange={(value) => updateFilterCriteria(index, { operator: value as any })}
                          >
                            <SelectTrigger className="border-border">
                              <SelectValue placeholder="Operator" />
                            </SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const field = PATIENT_FILTER_FIELDS.find(f => f.key === criteria.field)
                                return field?.allowedOperators.map((op) => (
                                  <SelectItem key={op} value={op}>
                                    {op.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                  </SelectItem>
                                )) || []
                              })()}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-3">
                          <Input
                            placeholder="Value"
                            value={criteria.value}
                            onChange={(e) => {
                              let value: any = e.target.value
                              if (criteria.dataType === 'number') {
                                value = value === '' ? '' : Number(value)
                              }
                              updateFilterCriteria(index, { value })
                            }}
                            type={criteria.dataType === 'number' ? 'number' : 'text'}
                            className="border-border focus:border-primary focus:ring-primary"
                          />
                        </div>

                        <div className="col-span-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFilterCriteria(index)}
                            className="h-10 w-10 p-0 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      onClick={addFilterCriteria}
                      className="w-full border-dashed border-border hover:border-primary hover:bg-primary/5"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Filter Rule
                    </Button>
                  </div>

                  {filterCriteria.length > 0 && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <h5 className="text-sm font-medium text-foreground mb-2">Filter Summary:</h5>
                      <div className="space-y-1">
                        {filterCriteria.map((criteria, index) => (
                          <div key={index} className="text-xs text-muted-foreground">
                            {index > 0 && `${criteria.logicalOperator} `}
                            {describeCriteria(criteria)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : selectedProject && currentProject ? (
              <div className="space-y-4 h-full overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold" style={{ color: COLORS.primary }}>
                    Patient Cohort
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      loadProjectAnalytics(selectedProject)
                      loadCohortPatients(selectedProject)
                    }}
                    disabled={isLoadingAnalytics || isLoadingCohort}
                    className="border-border"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingAnalytics || isLoadingCohort ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                  Anonymized patients matching project criteria for {currentProject.name}
                </p>

                {/* Project Info Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="border-border">
                    <CardContent className="p-3">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-2" style={{ color: COLORS.primary }} />
                        <div>
                          <div className="text-lg font-bold" style={{ color: COLORS.primary }}>
                            {currentProject.patientCount}
                          </div>
                          <div className="text-xs text-muted-foreground">Total Patients</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardContent className="p-3">
                      <div className="flex items-center">
                        <Activity className="w-4 h-4 mr-2" style={{ color: COLORS.secondary }} />
                        <div>
                          <div className="text-lg font-bold" style={{ color: COLORS.secondary }}>
                            {currentProject.status.charAt(0).toUpperCase() + currentProject.status.slice(1)}
                          </div>
                          <div className="text-xs text-muted-foreground">Project Status</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Cohort Table */}
                <div className="border rounded-lg bg-card">
                  <div className="grid grid-cols-6 gap-4 p-3 bg-muted font-medium text-sm border-b">
                    <div>Anonymous ID</div>
                    <div>Patient Name</div>
                    <div>Age</div>
                    <div>Group</div>
                    <div>Status</div>
                    <div>Actions</div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {isLoadingCohort ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : cohortPatients.length === 0 ? (
                      <div className="flex items-center justify-center py-8 text-center">
                        <div className="space-y-2">
                          <Users className="w-8 h-8 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">No patients in cohort yet</p>
                          <p className="text-xs text-muted-foreground">Add patients from Live Patient Matching</p>
                        </div>
                      </div>
                    ) : (
                      cohortPatients.map((patient) => (
                        <div key={patient.id} className="grid grid-cols-6 gap-4 p-3 border-b text-sm hover:bg-muted items-center">
                          <div className="font-mono text-xs font-semibold" style={{ color: COLORS.primary }}>
                            {patient.anonymous_id}
                          </div>
                          <div className="truncate">{patient.patient_name}</div>
                          <div>{patient.patient_age || 'N/A'}</div>
                          <div>
                            <Badge
                              variant="outline"
                              className="text-xs px-2 py-1 bg-teal-500/10 text-teal-400 border-teal-200"
                            >
                              {patient.group_name}
                            </Badge>
                          </div>
                          <div>
                            <Badge
                              variant="outline"
                              className={`text-xs px-2 py-1 ${
                                patient.status === 'included'
                                  ? 'bg-green-500/15 text-green-400 border-green-200'
                                  : 'bg-muted text-foreground border-border'
                              }`}
                            >
                              {patient.status}
                            </Badge>
                          </div>
                          <div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveFromCohort(patient.patient_id)}
                              className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Group Summary */}
                {cohortPatients.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2">Group Distribution</h4>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const groupCounts = cohortPatients.reduce((acc: Record<string, number>, patient) => {
                          acc[patient.group_name] = (acc[patient.group_name] || 0) + 1
                          return acc
                        }, {})
                        return Object.entries(groupCounts).map(([group, count]) => (
                          <Badge
                            key={group}
                            variant="outline"
                            className="px-3 py-1 bg-teal-500/10 text-teal-400 border-teal-200"
                          >
                            {group}: {count}
                          </Badge>
                        ))
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <div className="space-y-3">
                  <Users className="w-16 h-16 mx-auto text-muted-foreground" />
                  <h3 className="text-lg font-medium text-foreground">Select a Project</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Choose a research project to view patient cohort data and manage your study
                  </p>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Panel 3: Live Patient Matching or Analytics Dashboard */}
        <ResizablePanel defaultSize={35} minSize={25}>
          <div className="p-4 h-full bg-card flex flex-col">
            {isCreatingProject || isEditingProject ? (
              <div className="flex flex-col h-full gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold" style={{ color: COLORS.primary }}>
                    Live Patient Matching
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFindMatchingPatients}
                    disabled={isLoadingPatients}
                    className="border-border"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingPatients ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                  Real-time patient matching based on your filter criteria
                </p>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search patients by name, ID, or condition..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 border-border focus:border-primary focus:ring-primary"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (searchQuery.trim()) {
                        // Auto-select patients that match the search query
                        const matchingIds = filteredPatients.map(p => p.id)
                        setSelectedPatients(new Set(matchingIds))
                        if (matchingIds.length > 0) {
                          alert(`Selected ${matchingIds.length} patients matching "${searchQuery}"`)
                        }
                      }
                    }}
                    disabled={!searchQuery.trim() || filteredPatients.length === 0}
                    className="border-border text-teal-400 hover:bg-teal-500/100/10"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add All
                  </Button>
                </div>

                <div className="border rounded-lg bg-card flex-1 flex flex-col min-h-0">
                  <div className="grid grid-cols-5 gap-4 p-3 bg-muted font-medium text-sm border-b flex-shrink-0 items-center">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-teal-400 rounded focus:ring-teal-500"
                        checked={selectedPatients.size === filteredPatients.length && filteredPatients.length > 0}
                        onChange={() => {
                          if (selectedPatients.size === filteredPatients.length) {
                            handleDeselectAllPatients()
                          } else {
                            handleSelectAllPatients()
                          }
                        }}
                      />
                      <span>Select</span>
                    </div>
                    <div>Patient ID</div>
                    <div>Name</div>
                    <div>Age</div>
                    <div>Match %</div>
                  </div>

                  <div className="flex-1 min-h-0">
                    {isLoadingPatients ? (
                      <div className="flex items-center justify-center h-32">
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredPatients.length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-center">
                        <div className="space-y-2">
                          <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">No matching patients found</p>
                          <p className="text-xs text-muted-foreground">Adjust your filter criteria</p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full overflow-hidden">
                        <div className="h-full overflow-y-auto">
                          {filteredPatients.map((patient) => (
                            <div key={patient.id} className={`grid grid-cols-5 gap-4 p-3 border-b text-sm hover:bg-muted items-center ${selectedPatients.has(patient.id) ? 'bg-teal-500/10 border-teal-200' : ''}`}>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 text-teal-400 rounded focus:ring-teal-500"
                                  checked={selectedPatients.has(patient.id)}
                                  onChange={() => handlePatientToggle(patient.id)}
                                />
                              </div>
                              <div className="font-mono text-xs">{patient.id.substring(0, 8)}...</div>
                              <div className="truncate">{`${patient.firstName} ${patient.lastName}`}</div>
                              <div>{patient.age}</div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <Progress value={patient.matchScore} className="h-2 flex-1" />
                                  <span className="text-xs">{patient.matchScore}%</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-muted border-t flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Total matching patients: <span className="font-semibold">{filteredPatients.length}</span>
                        {selectedPatients.size > 0 && (
                          <span className="ml-2 text-teal-400">
                            | <span className="font-semibold">{selectedPatients.size}</span> selected
                          </span>
                        )}
                      </div>
                      {selectedPatients.size > 0 && (
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleAddSelectedToCohort}
                            disabled={!selectedProject}
                            className="text-xs border-teal-300 text-teal-400 hover:bg-teal-500/100/10"
                          >
                            <Users className="w-3 h-3 mr-1" />
                            Add to Cohort
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleDeselectAllPatients}
                            className="text-xs"
                          >
                            Clear Selection
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedProject ? (
              <Tabs defaultValue="analytics" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="ai-assistant">AI Assistant</TabsTrigger>
                </TabsList>

                <TabsContent value="analytics" className="flex-1 overflow-hidden">
                  <div className="space-y-4 h-full overflow-y-auto pb-4">
                    <h3 className="text-lg font-semibold" style={{ color: COLORS.primary }}>
                      Cohort Analysis
                    </h3>

                    {/* AI-Enhanced Insights Panel */}
                    {isLoadingEnhancedAnalytics ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-center space-y-2">
                          <RefreshCw className="w-8 h-8 animate-spin text-[#009688] mx-auto" />
                          <p className="text-sm text-muted-foreground">Generating AI-powered insights...</p>
                        </div>
                      </div>
                    ) : enhancedAnalytics ? (
                      <AIInsightsPanel
                        insights={enhancedAnalytics.insights}
                        dataQuality={enhancedAnalytics.metadata.dataQuality}
                        cohortSize={enhancedAnalytics.metadata.sampleSize}
                      />
                    ) : null}

                    {isLoadingAnalytics ? (
                      <div className="flex items-center justify-center h-32">
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : projectAnalytics ? (
                      <div className="space-y-4">
                        {/* Statistical Summary Section */}
                        <Card className="border-border bg-gradient-to-br from-teal-50 to-white">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center">
                              <Activity className="w-4 h-4 mr-2 text-teal-400" />
                              Statistical Summary
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-card rounded-lg p-2 border border-gray-100">
                                <p className="text-xs text-muted-foreground">Mean Age</p>
                                <p className="text-lg font-bold" style={{ color: COLORS.primary }}>
                                  {projectAnalytics.ageStats.mean} yrs
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  95% CI: {projectAnalytics.ageStats.ci95Lower}-{projectAnalytics.ageStats.ci95Upper}
                                </p>
                              </div>
                              <div className="bg-card rounded-lg p-2 border border-gray-100">
                                <p className="text-xs text-muted-foreground">Mode Age</p>
                                <p className="text-lg font-bold" style={{ color: COLORS.secondary }}>
                                  {projectAnalytics.ageStats.mode} yrs
                                </p>
                                <p className="text-xs text-muted-foreground">Most frequent</p>
                              </div>
                              <div className="bg-card rounded-lg p-2 border border-gray-100">
                                <p className="text-xs text-muted-foreground">Std Dev (σ)</p>
                                <p className="text-lg font-bold text-orange-600">
                                  ±{projectAnalytics.ageStats.sd}
                                </p>
                                <p className="text-xs text-muted-foreground">Variability</p>
                              </div>
                              <div className="bg-card rounded-lg p-2 border border-gray-100">
                                <p className="text-xs text-muted-foreground">Age Range</p>
                                <p className="text-lg font-bold text-purple-600">
                                  {projectAnalytics.ageStats.min}-{projectAnalytics.ageStats.max}
                                </p>
                                <p className="text-xs text-muted-foreground">{projectAnalytics.totalPatients} patients</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Age Distribution Histogram */}
                        {projectAnalytics.ageDistribution.length > 0 && (
                          <Card className="border-border">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Age Distribution</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={140}>
                                <BarChart data={projectAnalytics.ageDistribution}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="range" style={{ fontSize: '11px' }} />
                                  <YAxis style={{ fontSize: '11px' }} />
                                  <Tooltip />
                                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {projectAnalytics.ageDistribution.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        )}

                        {/* Distribution Charts Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Gender Distribution */}
                          <Card className="border-border">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-xs">Gender</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={100}>
                                <PieChart>
                                  <Pie
                                    data={projectAnalytics.genderDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={20}
                                    outerRadius={35}
                                    dataKey="value"
                                    label={(entry) => `${entry.name}: ${entry.value}`}
                                  >
                                    {projectAnalytics.genderDistribution.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                  </Pie>
                                  <Tooltip />
                                </PieChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>

                          {/* Outcome Distribution */}
                          <Card className="border-border">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-xs">Outcomes</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={100}>
                                <PieChart>
                                  <Pie
                                    data={projectAnalytics.outcomeDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={20}
                                    outerRadius={35}
                                    dataKey="value"
                                  >
                                    {projectAnalytics.outcomeDistribution.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                  </Pie>
                                  <Tooltip />
                                </PieChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Condition Distribution - Top Conditions */}
                        {projectAnalytics.conditionDistribution.length > 0 && (
                          <Card className="border-border">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Top Conditions</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={120}>
                                <BarChart
                                  data={projectAnalytics.conditionDistribution.slice(0, 5)}
                                  layout="vertical"
                                >
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis type="number" style={{ fontSize: '10px' }} />
                                  <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={100}
                                    style={{ fontSize: '9px' }}
                                    tick={{ width: 95 }}
                                  />
                                  <Tooltip />
                                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                    {projectAnalytics.conditionDistribution.slice(0, 5).map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        )}

                        {/* Treatment Analysis */}
                        <Card className="border-border">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Treatment Comparison</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={100}>
                              <BarChart data={projectAnalytics.treatmentComparison}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="treatment" style={{ fontSize: '10px' }} />
                                <YAxis style={{ fontSize: '10px' }} />
                                <Tooltip />
                                <Bar dataKey="successRate" fill="#009688" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>

                        {/* Healing Time Comparison */}
                        <Card className="border-border">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Healing Time Analysis</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={100}>
                              <BarChart data={projectAnalytics.healingTimeComparison}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="protocol" style={{ fontSize: '10px' }} />
                                <YAxis style={{ fontSize: '10px' }} />
                                <Tooltip />
                                <Bar dataKey="avgDays" fill="#005A9C" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>

                        {/* Statistical Insights */}
                        <Card className="border-teal-200 bg-teal-500/10">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center text-teal-300">
                              <Lightbulb className="w-4 h-4 mr-2" />
                              Key Insights
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="text-xs text-teal-400 space-y-1">
                              <p>• <strong>Sample Size:</strong> N={projectAnalytics.totalPatients} patients {projectAnalytics.totalPatients >= 30 ? '(adequate for statistical analysis)' : '(consider increasing sample size)'}</p>
                              <p>• <strong>Confidence Interval:</strong> 95% CI for mean age is [{projectAnalytics.ageStats.ci95Lower}, {projectAnalytics.ageStats.ci95Upper}] years</p>
                              <p>• <strong>Age Variability:</strong> Standard deviation of ±{projectAnalytics.ageStats.sd} years indicates {projectAnalytics.ageStats.sd < 10 ? 'low' : projectAnalytics.ageStats.sd < 15 ? 'moderate' : 'high'} variability</p>
                              {projectAnalytics.ageStats.mean !== projectAnalytics.ageStats.mode && (
                                <p>• <strong>Distribution:</strong> Mean ({projectAnalytics.ageStats.mean}) differs from mode ({projectAnalytics.ageStats.mode}), suggesting non-normal distribution</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-32 text-center">
                        <div className="space-y-2">
                          <BarChart3 className="w-8 h-8 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">No analytics data available</p>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="ai-assistant" className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
                  <div className="min-h-full p-4 pb-6">
                    <ResearchAIAssistant
                      key={`ai-assistant-${selectedProject || 'no-project'}`}
                      selectedProject={selectedProject}
                      projectAnalytics={projectAnalytics}
                      filterCriteria={filterCriteria}
                      matchingPatients={matchingPatients}
                      onAnalysisComplete={(analysis) => {
                        console.log('🤖 AI Analysis completed:', analysis)
                      }}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <div className="space-y-3">
                  <TrendingUp className="w-16 h-16 mx-auto text-muted-foreground" />
                  <h3 className="text-lg font-medium text-foreground">Analysis Dashboard</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Select a research project to view analytics and interact with the AI assistant
                  </p>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      )}

      {/* Group Selector Dialog */}
      <GroupSelectorDialog
        open={showGroupSelector}
        onOpenChange={setShowGroupSelector}
        onConfirm={handleGroupSelected}
        selectedPatientCount={selectedPatients.size}
        isLoading={isAddingToCohort}
      />

      {/* Delete Project Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Research Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project <strong>&quot;{projectToDelete?.name}&quot;</strong> and all associated cohort data.
              <br /><br />
              <span className="text-red-600 font-semibold">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Project
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}