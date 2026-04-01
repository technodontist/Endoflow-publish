'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X } from 'lucide-react'

interface MaterialsUsedTabProps {
  materials: Record<string, string>
  onChange: (materials: Record<string, string>) => void
  readOnly?: boolean
}

export function MaterialsUsedTab({ materials, onChange, readOnly }: MaterialsUsedTabProps) {
  const [newName, setNewName] = useState('')
  const [newDetail, setNewDetail] = useState('')

  const addMaterial = () => {
    const name = newName.trim()
    if (name) {
      onChange({ ...materials, [name]: newDetail.trim() || '' })
      setNewName('')
      setNewDetail('')
    }
  }

  const removeMaterial = (key: string) => {
    const updated = { ...materials }
    delete updated[key]
    onChange(updated)
  }

  const entries = Object.entries(materials)

  // Common dental materials
  const quickMaterials = [
    'GP Points', 'AH Plus Sealer', 'NaOCl 2.5%', 'EDTA 17%',
    'Composite (A2)', 'GIC', 'Zinc Oxide Eugenol', 'Ca(OH)2',
    'MTA', 'Rubber Dam', 'K-Files', 'ProTaper',
    'Impression Material', 'Bite Registration', 'Temporary Cement',
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-foreground">
            Materials & Instruments Used
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {entries.length > 0 ? (
            <div className="space-y-2">
              {entries.map(([name, detail]) => (
                <div
                  key={name}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{name}</p>
                    {detail && (
                      <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                    )}
                  </div>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMaterial(name)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No materials recorded yet
            </p>
          )}

          {!readOnly && (
            <>
              <div className="flex gap-2">
                <Input
                  placeholder="Material/instrument name..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                />
                <Input
                  placeholder="Details (optional)..."
                  value={newDetail}
                  onChange={(e) => setNewDetail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addMaterial()}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                />
                <Button onClick={addMaterial} disabled={!newName.trim()} size="sm" className="shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Quick Add</p>
                <div className="flex flex-wrap gap-1.5">
                  {quickMaterials
                    .filter(m => !materials[m])
                    .slice(0, 10)
                    .map(mat => (
                      <Button
                        key={mat}
                        variant="outline"
                        size="sm"
                        onClick={() => onChange({ ...materials, [mat]: '' })}
                        className="text-xs h-7 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        {mat}
                      </Button>
                    ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
