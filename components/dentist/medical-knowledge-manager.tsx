'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { BookOpen, Trash2, Upload, FileText, Calendar, User, Tag, AlertTriangle, Loader2 } from 'lucide-react'
import { getMedicalKnowledgeListAction, deleteMedicalKnowledgeAction } from '@/lib/actions/medical-knowledge'
import { toast } from 'sonner'
import { format } from 'date-fns'
import MedicalKnowledgeUploader from './medical-knowledge-uploader'

interface MedicalKnowledge {
  id: string
  title: string
  source_type: string
  specialty: string
  authors: string | null
  publication_year: number | null
  journal: string | null
  topics: string[]
  created_at: string
  uploaded_by: string
}

export default function MedicalKnowledgeManager() {
  const [activeTab, setActiveTab] = useState('upload')
  const [knowledgeList, setKnowledgeList] = useState<MedicalKnowledge[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKnowledge, setSelectedKnowledge] = useState<MedicalKnowledge | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (activeTab === 'manage') {
      loadKnowledgeList()
    }
  }, [activeTab])

  const loadKnowledgeList = async () => {
    setLoading(true)
    try {
      const result = await getMedicalKnowledgeListAction()
      if (result.success && result.data) {
        setKnowledgeList(result.data)
      } else {
        toast.error("Error", {
          description: result.error || "Failed to load knowledge list",
        })
      }
    } catch (error) {
      toast.error("Error", {
        description: "Failed to load medical knowledge list",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedKnowledge) return

    setIsDeleting(true)
    try {
      const result = await deleteMedicalKnowledgeAction(selectedKnowledge.id)

      if (result.success) {
        toast.success("Deleted Successfully", {
          description: `"${selectedKnowledge.title}" has been removed from the knowledge base`,
        })
        setShowDeleteDialog(false)
        setSelectedKnowledge(null)
        loadKnowledgeList() // Reload the list
      } else {
        toast.error("Delete Failed", {
          description: result.error || "Failed to delete research paper",
        })
      }
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleUploadComplete = () => {
    toast.success("Upload Successful", {
      description: "Medical knowledge has been added to the database",
    })
    // Switch to manage tab and reload
    setActiveTab('manage')
    loadKnowledgeList()
  }

  const getSourceTypeColor = (type: string) => {
    switch (type) {
      case 'research_paper':
        return 'bg-blue-100 text-blue-800'
      case 'textbook':
        return 'bg-purple-100 text-purple-800'
      case 'clinical_protocol':
        return 'bg-green-100 text-green-800'
      case 'case_study':
        return 'bg-orange-100 text-orange-800'
      case 'guideline':
        return 'bg-pink-100 text-pink-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getSpecialtyColor = (specialty: string) => {
    switch (specialty) {
      case 'endodontics':
        return 'bg-teal-100 text-teal-800'
      case 'periodontics':
        return 'bg-indigo-100 text-indigo-800'
      case 'prosthodontics':
        return 'bg-rose-100 text-rose-800'
      case 'oral_surgery':
        return 'bg-amber-100 text-amber-800'
      case 'general_dentistry':
        return 'bg-cyan-100 text-cyan-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload New
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Manage Knowledge
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <MedicalKnowledgeUploader onUploadComplete={handleUploadComplete} />
        </TabsContent>

        <TabsContent value="manage" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Medical Knowledge Base
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage your uploaded research papers, textbooks, and clinical protocols
                  </p>
                </div>
                <Button onClick={loadKnowledgeList} variant="outline" size="sm" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : knowledgeList.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Knowledge Entries Yet</h3>
                  <p className="text-gray-600 mb-4">Upload your first research paper or medical textbook</p>
                  <Button onClick={() => setActiveTab('upload')}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Now
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {knowledgeList.map((knowledge) => (
                    <Card key={knowledge.id} className="border-l-4 border-l-blue-600">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900">{knowledge.title}</h3>
                              <Badge className={getSourceTypeColor(knowledge.source_type)}>
                                {knowledge.source_type.replace('_', ' ')}
                              </Badge>
                              <Badge className={getSpecialtyColor(knowledge.specialty)}>
                                {knowledge.specialty}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600">
                              {knowledge.authors && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <span className="truncate">{knowledge.authors}</span>
                                </div>
                              )}
                              {knowledge.publication_year && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>{knowledge.publication_year}</span>
                                </div>
                              )}
                              {knowledge.journal && (
                                <div className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  <span className="truncate">{knowledge.journal}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>Uploaded {format(new Date(knowledge.created_at), 'MMM d, yyyy')}</span>
                              </div>
                            </div>

                            {knowledge.topics && knowledge.topics.length > 0 && (
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Tag className="h-3 w-3 text-gray-500" />
                                {knowledge.topics.slice(0, 5).map((topic) => (
                                  <Badge key={topic} variant="outline" className="text-xs">
                                    {topic.replace(/_/g, ' ')}
                                  </Badge>
                                ))}
                                {knowledge.topics.length > 5 && (
                                  <span className="text-xs text-gray-500">+{knowledge.topics.length - 5} more</span>
                                )}
                              </div>
                            )}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-4"
                            onClick={() => {
                              setSelectedKnowledge(knowledge)
                              setShowDeleteDialog(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete Medical Knowledge?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-medium text-gray-900">
                Are you sure you want to delete:{" "}
                <span className="font-bold">"{selectedKnowledge?.title}"</span>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-900">
                <p className="font-semibold mb-1">⚠️ This action cannot be undone!</p>
                <p className="text-xs">
                  This will permanently remove this knowledge entry from the AI system. The AI
                  co-pilot will no longer be able to reference this research in treatment
                  recommendations.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Permanently
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
