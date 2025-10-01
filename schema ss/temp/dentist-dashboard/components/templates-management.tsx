"use client"

import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { TemplateFormDialog, type Template } from "@/components/template-form-dialog"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Plus, Edit, Trash2, FileText } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Mock data for templates
const mockTemplates: Template[] = [
  {
    id: "1",
    name: "Root Canal Assessment",
    category: "endodontics",
    description: "Standard template for root canal treatment evaluation",
    content:
      "Chief Complaint:\n\nPain Assessment:\n- Location:\n- Intensity (1-10):\n- Duration:\n- Triggers:\n\nClinical Examination:\n- Percussion test:\n- Palpation:\n- Thermal test:\n- Electric pulp test:\n\nRadiographic Findings:\n\nDiagnosis:\n\nTreatment Plan:",
    createdAt: "2024-01-15",
    updatedAt: "2024-01-15",
  },
  {
    id: "2",
    name: "Periodontal Evaluation",
    category: "periodontics",
    description: "Comprehensive periodontal assessment template",
    content:
      "Periodontal History:\n\nGingival Assessment:\n- Color:\n- Texture:\n- Bleeding on probing:\n\nPocket Depths:\n\nMobility Assessment:\n\nRadiographic Analysis:\n\nDiagnosis:\n\nTreatment Recommendations:",
    createdAt: "2024-01-10",
    updatedAt: "2024-01-12",
  },
  {
    id: "3",
    name: "Oral Surgery Consultation",
    category: "oral-surgery",
    description: "Pre-surgical evaluation and planning template",
    content:
      "Surgical History:\n\nMedical Clearance:\n\nClinical Examination:\n\nRadiographic Assessment:\n\nSurgical Plan:\n\nRisks and Complications:\n\nPost-operative Instructions:",
    createdAt: "2024-01-08",
    updatedAt: "2024-01-08",
  },
]

export function TemplatesManagement() {
  const [templates, setTemplates] = useState<Template[]>(mockTemplates)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null)

  const handleCreateTemplate = () => {
    setEditingTemplate(null)
    setDialogOpen(true)
  }

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template)
    setDialogOpen(true)
  }

  const handleDeleteTemplate = (template: Template) => {
    setTemplateToDelete(template)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (templateToDelete) {
      setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id))
      setTemplateToDelete(null)
      setDeleteDialogOpen(false)
    }
  }

  const handleSaveTemplate = (templateData: Omit<Template, "id" | "createdAt" | "updatedAt">) => {
    if (editingTemplate) {
      // Update existing template
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplate.id
            ? { ...t, ...templateData, updatedAt: new Date().toISOString().split("T")[0] }
            : t,
        ),
      )
    } else {
      // Create new template
      const newTemplate: Template = {
        ...templateData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString().split("T")[0],
        updatedAt: new Date().toISOString().split("T")[0],
      }
      setTemplates((prev) => [...prev, newTemplate])
    }
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      endodontics: "bg-red-100 text-red-800",
      periodontics: "bg-blue-100 text-blue-800",
      "oral-surgery": "bg-purple-100 text-purple-800",
      restorative: "bg-green-100 text-green-800",
      orthodontics: "bg-yellow-100 text-yellow-800",
      general: "bg-gray-100 text-gray-800",
    }
    return colors[category] || colors.general
  }

  const columns: ColumnDef<Template>[] = [
    {
      accessorKey: "name",
      header: "Template Name",
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.getValue("name")}</span>
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <Badge className={getCategoryColor(row.getValue("category"))}>
          {(row.getValue("category") as string).replace("-", " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => <div className="max-w-[300px] truncate">{row.getValue("description")}</div>,
    },
    {
      accessorKey: "updatedAt",
      header: "Last Updated",
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">{new Date(row.getValue("updatedAt")).toLocaleDateString()}</div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const template = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDeleteTemplate(template)} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-primary">Clinical Templates</CardTitle>
              <CardDescription>Manage reusable templates for clinical documentation and assessments</CardDescription>
            </div>
            <Button onClick={handleCreateTemplate} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>New Template</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={templates} searchKey="name" searchPlaceholder="Search templates..." />
        </CardContent>
      </Card>

      <TemplateFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editingTemplate}
        onSave={handleSaveTemplate}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the template "{templateToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
