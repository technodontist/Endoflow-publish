"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Cloud, Upload, X, Check, ChevronsUpDown, FileImage, User } from "lucide-react"
import { cn } from "@/lib/utils"

// Mock patient data
const mockPatients = [
  { uhid: "UH001", name: "Sarah Johnson", phone: "+1-555-0123" },
  { uhid: "UH002", name: "Michael Chen", phone: "+1-555-0124" },
  { uhid: "UH003", name: "Emily Davis", phone: "+1-555-0125" },
  { uhid: "UH004", name: "James Wilson", phone: "+1-555-0126" },
  { uhid: "UH005", name: "Anna Martinez", phone: "+1-555-0127" },
  { uhid: "UH006", name: "David Brown", phone: "+1-555-0128" },
  { uhid: "UH007", name: "Lisa Thompson", phone: "+1-555-0129" },
]

// Mock uploaded images
const mockUploadedImages = [
  { id: 1, url: "/dental-x-ray.jpg", tag: "Pre-op IOPA #46" },
  { id: 2, url: "/dental-panoramic.jpg", tag: "Panoramic X-ray" },
  { id: 3, url: "/dental-intraoral.jpg", tag: "Intraoral Photo" },
  { id: 4, url: "/dental-bitewing.jpg", tag: "Bitewing X-ray" },
]

interface UploadedFile {
  id: number
  file: File
  preview: string
  tag: string
}

export default function FileUploaderPage() {
  const [selectedPatient, setSelectedPatient] = useState<(typeof mockPatients)[0] | null>(null)
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredPatients = mockPatients.filter(
    (patient) =>
      patient.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      patient.uhid.toLowerCase().includes(searchValue.toLowerCase()),
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    handleFiles(files)
  }

  const handleFiles = (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"))

    imageFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const newFile: UploadedFile = {
          id: Date.now() + Math.random(),
          file,
          preview: e.target?.result as string,
          tag: "",
        }
        setUploadedFiles((prev) => [...prev, newFile])
      }
      reader.readAsDataURL(file)
    })
  }

  const updateFileTag = (fileId: number, tag: string) => {
    setUploadedFiles((prev) => prev.map((file) => (file.id === fileId ? { ...file, tag } : file)))
  }

  const removeFile = (fileId: number) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId))
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Patient Search */}
          <Card className="shadow-lg">
            <CardHeader className="bg-[#005A9C] text-white rounded-t-lg">
              <CardTitle className="text-2xl font-semibold text-center">File Uploader</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <Label className="text-[#005A9C] font-medium text-lg">Select Patient</Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between h-12 text-left border-gray-300 hover:border-[#009688] bg-transparent"
                    >
                      {selectedPatient ? (
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-[#005A9C]/10 text-[#005A9C]">
                              {selectedPatient.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{selectedPatient.name}</div>
                            <div className="text-sm text-muted-foreground">UHID: {selectedPatient.uhid}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Search patient by name or UHID...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search patient..."
                        value={searchValue}
                        onValueChange={setSearchValue}
                      />
                      <CommandList>
                        <CommandEmpty>No patient found.</CommandEmpty>
                        <CommandGroup>
                          {filteredPatients.map((patient) => (
                            <CommandItem
                              key={patient.uhid}
                              value={`${patient.name} ${patient.uhid}`}
                              onSelect={() => {
                                setSelectedPatient(patient)
                                setOpen(false)
                                setSearchValue("")
                              }}
                            >
                              <div className="flex items-center gap-3 w-full">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-[#005A9C]/10 text-[#005A9C]">
                                    {patient.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="font-medium">{patient.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    UHID: {patient.uhid} • {patient.phone}
                                  </div>
                                </div>
                                <Check
                                  className={cn(
                                    "ml-auto h-4 w-4",
                                    selectedPatient?.uhid === patient.uhid ? "opacity-100" : "opacity-0",
                                  )}
                                />
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Selected Patient Header */}
          {selectedPatient && (
            <Card className="shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-[#009688]/10 text-[#009688] text-lg">
                      {selectedPatient.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-semibold text-[#005A9C]">{selectedPatient.name}</h2>
                    <p className="text-muted-foreground">UHID: {selectedPatient.uhid}</p>
                  </div>
                  <Badge className="ml-auto bg-[#009688] hover:bg-[#00796B]">
                    <User className="h-3 w-3 mr-1" />
                    Selected
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* File Upload Zone */}
          {selectedPatient && (
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer",
                    isDragOver
                      ? "border-[#009688] bg-[#009688]/5"
                      : "border-gray-300 hover:border-[#009688] hover:bg-gray-50",
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Cloud className="h-16 w-16 mx-auto mb-4 text-[#009688]" />
                  <h3 className="text-xl font-semibold text-[#005A9C] mb-2">Drop files here or click to upload</h3>
                  <p className="text-muted-foreground mb-4">
                    Drag and drop your medical images, or click to browse files
                  </p>
                  <Button className="bg-[#009688] hover:bg-[#00796B]">
                    <Upload className="h-4 w-4 mr-2" />
                    Choose Files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recently Uploaded Images */}
          {selectedPatient && (uploadedFiles.length > 0 || mockUploadedImages.length > 0) && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#005A9C]">
                  <FileImage className="h-5 w-5" />
                  Recently Uploaded Images
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {/* Mock uploaded images */}
                  {mockUploadedImages.map((image) => (
                    <div key={image.id} className="space-y-3">
                      <div className="relative group">
                        <img
                          src={image.url || "/placeholder.svg"}
                          alt="Medical image"
                          className="w-full h-40 object-cover rounded-lg border shadow-sm"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <Button size="sm" variant="destructive" className="opacity-90">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-[#005A9C]">Description</Label>
                        <Input
                          placeholder="Add descriptive tag..."
                          value={image.tag}
                          readOnly
                          className="text-sm border-gray-300 focus:border-[#009688] focus:ring-[#009688]"
                        />
                      </div>
                    </div>
                  ))}

                  {/* Newly uploaded files */}
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="space-y-3">
                      <div className="relative group">
                        <img
                          src={file.preview || "/placeholder.svg"}
                          alt="Uploaded image"
                          className="w-full h-40 object-cover rounded-lg border shadow-sm"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeFile(file.id)}
                            className="opacity-90"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-[#005A9C]">Description</Label>
                        <Input
                          placeholder="Add descriptive tag..."
                          value={file.tag}
                          onChange={(e) => updateFileTag(file.id, e.target.value)}
                          className="text-sm border-gray-300 focus:border-[#009688] focus:ring-[#009688]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
