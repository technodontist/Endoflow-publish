'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, X, CheckCircle } from 'lucide-react'

interface ProceduresDoneTabProps {
  procedures: string[]
  onChange: (procedures: string[]) => void
  readOnly?: boolean
}

export function ProceduresDoneTab({ procedures, onChange, readOnly }: ProceduresDoneTabProps) {
  const [newProcedure, setNewProcedure] = useState('')

  const addProcedure = () => {
    const trimmed = newProcedure.trim()
    if (trimmed && !procedures.includes(trimmed)) {
      onChange([...procedures, trimmed])
      setNewProcedure('')
    }
  }

  const removeProcedure = (index: number) => {
    onChange(procedures.filter((_, i) => i !== index))
  }

  // Common dental procedures for quick-add
  const quickProcedures = [
    'Access opening', 'Biomechanical preparation', 'Obturation',
    'Crown preparation', 'Impression taking', 'Cementation',
    'Composite restoration', 'Scaling & polishing', 'Extraction',
    'Incision & drainage', 'Pulp capping', 'Post space preparation',
    'Try-in', 'Temporary restoration', 'Suture removal',
  ]

  const availableQuickProcedures = quickProcedures.filter(p => !procedures.includes(p))

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-foreground">
            Procedures Done Today
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current procedures list */}
          {procedures.length > 0 ? (
            <div className="space-y-2">
              {procedures.map((proc, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20"
                >
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-sm text-foreground flex-1">{proc}</span>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProcedure(idx)}
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
              No procedures recorded yet
            </p>
          )}

          {/* Add procedure */}
          {!readOnly && (
            <div className="flex gap-2">
              <Input
                placeholder="Enter procedure performed..."
                value={newProcedure}
                onChange={(e) => setNewProcedure(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addProcedure()}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
              <Button
                onClick={addProcedure}
                disabled={!newProcedure.trim()}
                size="sm"
                className="shrink-0"
              >
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
          )}

          {/* Quick-add buttons */}
          {!readOnly && availableQuickProcedures.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Quick Add</p>
              <div className="flex flex-wrap gap-1.5">
                {availableQuickProcedures.slice(0, 10).map(proc => (
                  <Button
                    key={proc}
                    variant="outline"
                    size="sm"
                    onClick={() => onChange([...procedures, proc])}
                    className="text-xs h-7 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    {proc}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
