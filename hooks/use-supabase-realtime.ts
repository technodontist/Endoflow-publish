import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseSupabaseRealtimeProps {
  table: string
  schema?: string
  onInsert?: (payload: any) => void
  onUpdate?: (payload: any) => void
  onDelete?: (payload: any) => void
}

export function useSupabaseRealtime({
  table,
  schema = 'public',
  onInsert,
  onUpdate,
  onDelete,
}: UseSupabaseRealtimeProps) {
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`${schema}.${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema,
          table,
        },
        (payload) => {
          console.log('Real-time update:', payload)

          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.(payload)
              break
            case 'UPDATE':
              onUpdate?.(payload)
              break
            case 'DELETE':
              onDelete?.(payload)
              break
          }
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, schema, onInsert, onUpdate, onDelete])
}