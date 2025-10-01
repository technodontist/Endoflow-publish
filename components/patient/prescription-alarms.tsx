"use client"

import React from "react"
import { WorkingPrescriptionAlarms } from "./working-prescription-alarms"

interface PrescriptionAlarmsProps {
  patientId: string
}

export function PrescriptionAlarms({ patientId }: PrescriptionAlarmsProps) {
  return <WorkingPrescriptionAlarms patientId={patientId} />
}