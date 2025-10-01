'use client';

import React, { useState, useEffect } from 'react'
import ContextualAppointmentForm from '@/components/appointments/ContextualAppointmentForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

export default function DentistContextualAppointmentPage() {
  const supabase = createClient()
  const [patientId, setPatientId] = useState('')
  const [dentistId, setDentistId] = useState('')

  // lightweight search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; first_name: string; last_name: string }>>([])

  useEffect(() => {
    // allow prefill via URL ?patientId=...&dentistId=...
    (async () => {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        const p = url.searchParams.get('patientId') || ''
        const d = url.searchParams.get('dentistId') || ''
        if (p) setPatientId(p)
        if (d) setDentistId(d)
      }
      // If dentistId was not provided, default to the logged-in dentist id
      if (!dentistId) {
        const { createClient } = await import('@/lib/supabase/client')
        const sb = createClient()
        const { data: { user } } = await sb.auth.getUser()
        if (user?.id) setDentistId(user.id)
      }
    })()
  }, [])

  // Global keydown guard (capture phase) to prevent accidental redirects while typing in inputs on this page
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase?.()
      const isInputLike = tag === 'input' || tag === 'textarea' || target?.getAttribute('contenteditable') === 'true' || (target as any)?.isContentEditable
      if (isInputLike) {
        if (ev.key === 'Enter') ev.preventDefault()
        ev.stopPropagation()
        ;(ev as any).stopImmediatePropagation?.()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  useEffect(() => {
    const run = async () => {
      if (!query || patientId) { setResults([]); return }
      const { data } = await supabase
        .schema('api')
        .from('patients')
        .select('id, first_name, last_name')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(10)
      setResults(data || [])
    }
    const t = setTimeout(run, 250)
    return () => clearTimeout(t)
  }, [query, patientId, supabase])

  return (
    <div className="max-w-2xl mx-auto p-6" onKeyDown={(e)=>{e.stopPropagation()}}>
      <Card>
        <CardHeader>
          <CardTitle>Contextual Appointment (Dentist)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!patientId && (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs text-gray-600">Search Patient by name or ID</label>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter'){e.preventDefault()} e.stopPropagation()}} placeholder="Start typing a name or paste ID" />
              </div>
              {results.length > 0 && (
                <div className="border rounded p-2 max-h-56 overflow-auto text-sm">
                  {results.map(r => (
                    <div key={r.id} className="px-2 py-1 hover:bg-gray-50 cursor-pointer" onClick={() => setPatientId(r.id)}>
                      {r.first_name} {r.last_name} — <span className="text-gray-500 text-xs">{r.id.slice(0,8)}...</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs text-gray-600">Or paste Patient ID</label>
                <Input value={patientId} onChange={(e) => setPatientId(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter'){e.preventDefault()} e.stopPropagation()}} placeholder="Paste patient UUID" />
              </div>
            </div>
          )}
          {!!patientId && (
            <ContextualAppointmentForm patientId={patientId} defaultDentistId={dentistId || undefined} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
