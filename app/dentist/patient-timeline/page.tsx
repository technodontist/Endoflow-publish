'use client';

import { useEffect, useState } from 'react';
import { PatientBirdsEyeTimeline } from '@/components/dentist/patient-birdseye-timeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function DentistPatientTimelineBirdsEyePage() {
  const [patientId, setPatientId] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const p = url.searchParams.get('patientId') || '';
      if (p) setPatientId(p);
    }
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Bird&apos;s-eye Patient Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!patientId && (
            <div className="space-y-2">
              <label className="text-xs text-gray-600">Patient ID</label>
              <Input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="Paste patient UUID" />
            </div>
          )}
          {!!patientId && (
            <PatientBirdsEyeTimeline patientId={patientId} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}