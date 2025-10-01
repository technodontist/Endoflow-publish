'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  FileText,
  ChevronDown,
  X
} from 'lucide-react'
import {
  getTemplatesAction,
  createTemplateAction,
  updateTemplateAction,
  deleteTemplateAction,
  getTemplateCategoriesAction
} from '@/lib/actions/templates'

// Define template interface based on database schema
interface ClinicalTemplate {
  id: string
  name: string
  category: TemplateCategory
  description: string
  templateContent: string
  formFields: string
  defaultValues?: string
  isPublic?: boolean
  isActive?: boolean
  usageCount?: number
  specialties?: string[]
  tags?: string[]
  clinicalIndications?: string
  version?: string
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
}

type TemplateCategory =
  | 'endodontics'
  | 'periodontics'
  | 'oral_surgery'
  | 'restorative'
  | 'orthodontics'
  | 'general'
  | 'emergency'
  | 'pediatric'
  | 'prosthetics'
  | 'diagnostics'

const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string; color: string }[] = [
  { value: 'endodontics', label: 'Endodontics', color: 'bg-red-100 text-red-800' },
  { value: 'periodontics', label: 'Periodontics', color: 'bg-blue-100 text-blue-800' },
  { value: 'oral_surgery', label: 'Oral Surgery', color: 'bg-purple-100 text-purple-800' },
  { value: 'restorative', label: 'Restorative', color: 'bg-teal-100 text-teal-800' },
  { value: 'orthodontics', label: 'Orthodontics', color: 'bg-orange-100 text-orange-800' },
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-800' },
  { value: 'emergency', label: 'Emergency', color: 'bg-red-100 text-red-800' },
  { value: 'pediatric', label: 'Pediatric', color: 'bg-green-100 text-green-800' },
  { value: 'prosthetics', label: 'Prosthetics', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'diagnostics', label: 'Diagnostics', color: 'bg-yellow-100 text-yellow-800' }
]

export function TemplatesDashboard() {
  // State Management
  const [templates, setTemplates] = useState<ClinicalTemplate[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ClinicalTemplate | null>(null)

  // Form State for New/Edit Template
  const [templateForm, setTemplateForm] = useState({
    name: '',
    category: 'general' as TemplateCategory,
    description: '',
    templateContent: '',
    formFields: '[]',
    isPublic: false,
    tags: [] as string[],
    specialties: [] as string[],
    clinicalIndications: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Load templates on component mount
  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const result = await getTemplatesAction()

      if (result.error) {
        setError(result.error)
        console.error('Failed to load templates:', result.error)
        return
      }

      if (result.templates) {
        setTemplates(result.templates)
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
      setError('Failed to load templates')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           template.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
      const isActive = template.isActive !== false // Default to true if undefined

      return matchesSearch && matchesCategory && isActive
    })
  }, [templates, searchQuery, selectedCategory])

  const resetForm = useCallback(() => {
    setTemplateForm({
      name: '',
      category: 'general',
      description: '',
      templateContent: '',
      formFields: '[]',
      isPublic: false,
      tags: [],
      specialties: [],
      clinicalIndications: ''
    })
    setError('')
    setSuccess('')
  }, [])

  const handleCreateTemplate = useCallback(async () => {
    setError('')
    setSuccess('')

    try {
      const result = await createTemplateAction({
        name: templateForm.name,
        description: templateForm.description,
        category: templateForm.category,
        templateContent: templateForm.templateContent,
        formFields: templateForm.formFields,
        isPublic: templateForm.isPublic,
        tags: templateForm.tags,
        specialties: templateForm.specialties,
        clinicalIndications: templateForm.clinicalIndications
      })

      if (result.error) {
        setError(result.error)
        console.error('Failed to create template:', result.error)
        return
      }

      if (result.success && result.template) {
        setSuccess(result.success)
        setIsCreating(false)
        resetForm()
        // Reload templates to get updated list
        await loadTemplates()
      }
    } catch (error) {
      console.error('Failed to create template:', error)
      setError('Failed to create template')
    }
  }, [templateForm, resetForm, loadTemplates])

  const handleEditTemplate = useCallback((template: ClinicalTemplate) => {
    setEditingTemplate(template)
    setTemplateForm({
      name: template.name,
      category: template.category,
      description: template.description,
      templateContent: template.templateContent,
      formFields: template.formFields,
      isPublic: template.isPublic || false,
      tags: template.tags || [],
      specialties: template.specialties || [],
      clinicalIndications: template.clinicalIndications || ''
    })
    setError('')
    setSuccess('')
  }, [])

  const handleUpdateTemplate = useCallback(async () => {
    if (!editingTemplate) return

    setError('')
    setSuccess('')

    try {
      const result = await updateTemplateAction({
        id: editingTemplate.id,
        name: templateForm.name,
        description: templateForm.description,
        category: templateForm.category,
        templateContent: templateForm.templateContent,
        formFields: templateForm.formFields,
        isPublic: templateForm.isPublic,
        tags: templateForm.tags,
        specialties: templateForm.specialties,
        clinicalIndications: templateForm.clinicalIndications
      })

      if (result.error) {
        setError(result.error)
        console.error('Failed to update template:', result.error)
        return
      }

      if (result.success) {
        setSuccess(result.success)
        setEditingTemplate(null)
        resetForm()
        // Reload templates to get updated data
        await loadTemplates()
      }
    } catch (error) {
      console.error('Failed to update template:', error)
      setError('Failed to update template')
    }
  }, [editingTemplate, templateForm, resetForm, loadTemplates])

  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      return
    }

    setError('')
    setSuccess('')

    try {
      const result = await deleteTemplateAction(templateId)

      if (result.error) {
        setError(result.error)
        console.error('Failed to delete template:', result.error)
        return
      }

      if (result.success) {
        setSuccess(result.success)
        // Reload templates to reflect the deletion
        await loadTemplates()
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
      setError('Failed to delete template')
    }
  }, [loadTemplates])

  const getCategoryInfo = useCallback((category: TemplateCategory) => {
    return TEMPLATE_CATEGORIES.find(cat => cat.value === category) || TEMPLATE_CATEGORIES[0]
  }, [])

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Clinical Templates</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage reusable templates for clinical documentation and assessments
              </p>
            </div>
            <Dialog open={isCreating} onOpenChange={setIsCreating}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  New Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Template</DialogTitle>
                </DialogHeader>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md">
                    {success}
                  </div>
                )}
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Template Name</label>
                      <Input
                        placeholder="Enter template name"
                        value={templateForm.name}
                        onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Category</label>
                      <Select
                        value={templateForm.category}
                        onValueChange={(value: TemplateCategory) =>
                          setTemplateForm(prev => ({ ...prev, category: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEMPLATE_CATEGORIES.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <Input
                      placeholder="Brief description of the template"
                      value={templateForm.description}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Template Content</label>
                    <Textarea
                      placeholder="Enter the template content here..."
                      rows={12}
                      value={templateForm.templateContent}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, templateContent: e.target.value }))}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={() => {
                      setIsCreating(false)
                      resetForm()
                    }}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateTemplate}
                      disabled={!templateForm.name || !templateForm.description || !templateForm.templateContent}
                    >
                      Create Template
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={(value: any) => setSelectedCategory(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {TEMPLATE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Columns
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Template Name</DropdownMenuItem>
                    <DropdownMenuItem>Category</DropdownMenuItem>
                    <DropdownMenuItem>Description</DropdownMenuItem>
                    <DropdownMenuItem>Last Updated</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <FileText className="w-4 h-4" />
                  </TableHead>
                  <TableHead>Template Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-600">Loading templates...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="text-gray-500">
                        {searchQuery || selectedCategory !== 'all' ?
                          'No templates match your search criteria.' :
                          'No templates found. Create your first template to get started.'
                        }
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTemplates.map((template) => {
                    const categoryInfo = getCategoryInfo(template.category)
                    return (
                      <TableRow key={template.id}>
                        <TableCell>
                          <FileText className="w-4 h-4 text-gray-400" />
                        </TableCell>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>
                          <Badge className={`${categoryInfo.color} border-0`}>
                            {categoryInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-600 max-w-md truncate">
                          {template.description}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {new Date(template.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-4 text-sm text-gray-500">
          {filteredTemplates.length === 0 ?
            '0 of 0 row(s) selected.' :
            `0 of ${filteredTemplates.length} row(s) selected.`
          }
        </div>
      </div>

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <p className="text-sm text-gray-600">Update the template details below.</p>
          </DialogHeader>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md">
              {success}
            </div>
          )}
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Template Name</label>
                <Input
                  placeholder="Enter template name"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select
                  value={templateForm.category}
                  onValueChange={(value: TemplateCategory) =>
                    setTemplateForm(prev => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Input
                placeholder="Brief description of the template"
                value={templateForm.description}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Template Content</label>
              <Textarea
                placeholder="Enter the template content here..."
                rows={12}
                value={templateForm.templateContent}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, templateContent: e.target.value }))}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => {
                setEditingTemplate(null)
                resetForm()
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdateTemplate}
                disabled={!templateForm.name || !templateForm.description || !templateForm.templateContent}
              >
                Update Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}