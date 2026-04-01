/**
 * EndoFlow Consultation Report Generator
 *
 * Generates PDF reports containing:
 * - Patient info header
 * - Consultation details (date, mode, dentist)
 * - Chief complaint & clinical findings
 * - AI diagnosis & treatment plan
 * - Per-tooth findings summary
 * - Prescriptions
 * - Follow-up plan
 * - Dentist signature line
 *
 * Uses pdf-lib for server-side PDF generation (no browser required).
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'

// ─── Types ──────────────────────────────────────────

export interface ReportData {
  // Patient info
  patient: {
    name: string
    age?: number
    gender?: string
    uhid?: string
    phone?: string
  }

  // Consultation info
  consultation: {
    id: string
    date: string
    mode: string // new_consultation, treatment_visit, follow_up, emergency
    dentistName: string
    clinicName?: string
  }

  // Clinical data from consultation
  clinicalData: {
    chiefComplaint?: string
    hpiSummary?: string
    medicalHistory?: string
    clinicalExamination?: string
    investigations?: string
  }

  // AI diagnosis output (if available)
  aiDiagnosis?: {
    primaryDiagnosis?: string
    differentials?: string[]
    confidence?: number
    treatmentPlan?: string
    prognosis?: string
    evidenceCitations?: string[]
  }

  // Per-tooth findings
  toothFindings: {
    toothNumber: string
    diagnosis: string
    treatment: string
    status: string
    priority?: string
  }[]

  // Prescriptions
  prescriptions: {
    name: string
    dosage: string
    frequency: string
    duration: string
    instructions?: string
  }[]

  // Follow-up
  followUp?: {
    plan: string
    nextAppointmentDate?: string
    instructions?: string
  }

  // Conversation transcript (optional, can be long)
  transcript?: string

  // Session 12: Clinical images for PDF embedding
  clinicalImages?: {
    url: string       // Signed URL from Supabase storage
    type: string      // X-Ray, Oral Photo, etc.
    description: string
    mimeType?: string // image/jpeg, image/png
  }[]
}

// ─── PDF Generation ─────────────────────────────────

const MARGIN = 50
const PAGE_WIDTH = 595 // A4
const PAGE_HEIGHT = 842 // A4
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)

// Colors
const TEAL = rgb(0, 150/255, 136/255)   // EndoFlow brand
const DARK = rgb(0.1, 0.1, 0.1)
const GRAY = rgb(0.4, 0.4, 0.4)
const LIGHT_GRAY = rgb(0.85, 0.85, 0.85)
const WHITE = rgb(1, 1, 1)

class PDFReportBuilder {
  private doc: PDFDocument
  private page: PDFPage
  private y: number
  private fontRegular!: PDFFont
  private fontBold!: PDFFont
  private pageCount: number = 1

  constructor(doc: PDFDocument, page: PDFPage) {
    this.doc = doc
    this.page = page
    this.y = PAGE_HEIGHT - MARGIN
  }

  async init() {
    this.fontRegular = await this.doc.embedFont(StandardFonts.Helvetica)
    this.fontBold = await this.doc.embedFont(StandardFonts.HelveticaBold)
  }

  private checkNewPage(neededSpace: number = 60) {
    if (this.y < MARGIN + neededSpace) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      this.pageCount++
      this.y = PAGE_HEIGHT - MARGIN
    }
  }

  private drawText(text: string, options: {
    x?: number
    size?: number
    font?: PDFFont
    color?: ReturnType<typeof rgb>
    maxWidth?: number
  } = {}) {
    const {
      x = MARGIN,
      size = 10,
      font = this.fontRegular,
      color = DARK,
      maxWidth = CONTENT_WIDTH,
    } = options

    // Word-wrap text
    const words = text.split(' ')
    let line = ''
    const lines: string[] = []

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word
      const testWidth = font.widthOfTextAtSize(testLine, size)

      if (testWidth > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = testLine
      }
    }
    if (line) lines.push(line)

    for (const ln of lines) {
      this.checkNewPage()
      this.page.drawText(ln, { x, y: this.y, size, font, color })
      this.y -= size + 4
    }
  }

  private drawLine(thickness: number = 0.5, color: ReturnType<typeof rgb> = LIGHT_GRAY) {
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness,
      color,
    })
    this.y -= 10
  }

  private drawSectionHeader(title: string) {
    this.checkNewPage(40)
    this.y -= 8

    // Teal bar
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - 2,
      width: CONTENT_WIDTH,
      height: 18,
      color: TEAL,
    })

    this.page.drawText(title.toUpperCase(), {
      x: MARGIN + 8,
      y: this.y + 2,
      size: 10,
      font: this.fontBold,
      color: WHITE,
    })

    this.y -= 26
  }

  private drawKeyValue(key: string, value: string, indent: number = 0) {
    if (!value) return
    this.checkNewPage()

    const keyWidth = this.fontBold.widthOfTextAtSize(key + ': ', 9)

    this.page.drawText(key + ':', {
      x: MARGIN + indent,
      y: this.y,
      size: 9,
      font: this.fontBold,
      color: GRAY,
    })

    // Value wraps
    const valueMaxWidth = CONTENT_WIDTH - keyWidth - indent - 10
    const words = value.split(' ')
    let line = ''
    let firstLine = true

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word
      const maxW = firstLine ? valueMaxWidth : CONTENT_WIDTH - indent
      const testWidth = this.fontRegular.widthOfTextAtSize(testLine, 9)

      if (testWidth > maxW && line) {
        if (firstLine) {
          this.page.drawText(line, {
            x: MARGIN + indent + keyWidth,
            y: this.y,
            size: 9,
            font: this.fontRegular,
            color: DARK,
          })
          firstLine = false
        } else {
          this.page.drawText(line, {
            x: MARGIN + indent,
            y: this.y,
            size: 9,
            font: this.fontRegular,
            color: DARK,
          })
        }
        this.y -= 13
        this.checkNewPage()
        line = word
      } else {
        line = testLine
      }
    }

    if (line) {
      if (firstLine) {
        this.page.drawText(line, {
          x: MARGIN + indent + keyWidth,
          y: this.y,
          size: 9,
          font: this.fontRegular,
          color: DARK,
        })
      } else {
        this.page.drawText(line, {
          x: MARGIN + indent,
          y: this.y,
          size: 9,
          font: this.fontRegular,
          color: DARK,
        })
      }
    }

    this.y -= 15
  }

  async build(data: ReportData): Promise<Uint8Array> {
    await this.init()

    // ═══ HEADER ═══
    this.page.drawRectangle({
      x: 0, y: PAGE_HEIGHT - 80,
      width: PAGE_WIDTH, height: 80,
      color: TEAL,
    })

    this.page.drawText(data.consultation.clinicName || 'EndoFlow Dental Clinic', {
      x: MARGIN,
      y: PAGE_HEIGHT - 35,
      size: 18,
      font: this.fontBold,
      color: WHITE,
    })

    this.page.drawText('CONSULTATION REPORT', {
      x: MARGIN,
      y: PAGE_HEIGHT - 55,
      size: 11,
      font: this.fontRegular,
      color: rgb(0.9, 1, 0.98),
    })

    // Date on right
    this.page.drawText(data.consultation.date, {
      x: PAGE_WIDTH - MARGIN - 100,
      y: PAGE_HEIGHT - 35,
      size: 10,
      font: this.fontRegular,
      color: WHITE,
    })

    this.y = PAGE_HEIGHT - 95

    // ═══ PATIENT INFO ═══
    this.drawSectionHeader('Patient Information')
    this.drawKeyValue('Name', data.patient.name)
    if (data.patient.age) this.drawKeyValue('Age / Gender', `${data.patient.age}${data.patient.gender ? ` / ${data.patient.gender}` : ''}`)
    if (data.patient.uhid) this.drawKeyValue('UHID', data.patient.uhid)
    if (data.patient.phone) this.drawKeyValue('Phone', data.patient.phone)
    this.drawKeyValue('Dentist', data.consultation.dentistName)

    const modeLabels: Record<string, string> = {
      new_consultation: 'New Consultation',
      treatment_visit: 'Treatment Visit',
      follow_up: 'Follow-Up',
      emergency: 'Emergency',
    }
    this.drawKeyValue('Visit Type', modeLabels[data.consultation.mode] || data.consultation.mode)

    // ═══ CLINICAL FINDINGS ═══
    if (data.clinicalData.chiefComplaint || data.clinicalData.hpiSummary || data.clinicalData.medicalHistory) {
      this.drawSectionHeader('Clinical Findings')

      if (data.clinicalData.chiefComplaint) {
        this.drawKeyValue('Chief Complaint', data.clinicalData.chiefComplaint)
      }
      if (data.clinicalData.hpiSummary) {
        this.drawKeyValue('History of Present Illness', data.clinicalData.hpiSummary)
      }
      if (data.clinicalData.medicalHistory) {
        this.drawKeyValue('Medical History', data.clinicalData.medicalHistory)
      }
      if (data.clinicalData.clinicalExamination) {
        this.drawKeyValue('Clinical Examination', data.clinicalData.clinicalExamination)
      }
      if (data.clinicalData.investigations) {
        this.drawKeyValue('Investigations', data.clinicalData.investigations)
      }
    }

    // ═══ AI DIAGNOSIS ═══
    if (data.aiDiagnosis) {
      this.drawSectionHeader('Diagnosis & Treatment Plan')

      if (data.aiDiagnosis.primaryDiagnosis) {
        this.drawKeyValue('Primary Diagnosis', data.aiDiagnosis.primaryDiagnosis)
      }
      if (data.aiDiagnosis.confidence) {
        this.drawKeyValue('Confidence', `${data.aiDiagnosis.confidence}%`)
      }
      if (data.aiDiagnosis.differentials && data.aiDiagnosis.differentials.length > 0) {
        this.drawKeyValue('Differentials', data.aiDiagnosis.differentials.join(', '))
      }
      if (data.aiDiagnosis.treatmentPlan) {
        this.drawKeyValue('Treatment Plan', data.aiDiagnosis.treatmentPlan)
      }
      if (data.aiDiagnosis.prognosis) {
        this.drawKeyValue('Prognosis', data.aiDiagnosis.prognosis)
      }
      if (data.aiDiagnosis.evidenceCitations && data.aiDiagnosis.evidenceCitations.length > 0) {
        this.y -= 5
        this.drawText('Evidence Citations:', { size: 9, font: this.fontBold, color: GRAY })
        for (const cite of data.aiDiagnosis.evidenceCitations.slice(0, 5)) {
          this.drawText(`  - ${cite}`, { size: 8, color: GRAY })
        }
      }
    }

    // ═══ TOOTH FINDINGS ═══
    if (data.toothFindings.length > 0) {
      this.drawSectionHeader('Tooth-Specific Findings')

      // Table header
      this.checkNewPage(30)
      const colX = [MARGIN, MARGIN + 50, MARGIN + 200, MARGIN + 370]

      this.page.drawRectangle({
        x: MARGIN, y: this.y - 2,
        width: CONTENT_WIDTH, height: 16,
        color: rgb(0.93, 0.93, 0.93),
      })

      this.page.drawText('Tooth', { x: colX[0] + 4, y: this.y + 2, size: 8, font: this.fontBold, color: DARK })
      this.page.drawText('Diagnosis', { x: colX[1] + 4, y: this.y + 2, size: 8, font: this.fontBold, color: DARK })
      this.page.drawText('Treatment', { x: colX[2] + 4, y: this.y + 2, size: 8, font: this.fontBold, color: DARK })
      this.page.drawText('Priority', { x: colX[3] + 4, y: this.y + 2, size: 8, font: this.fontBold, color: DARK })
      this.y -= 18

      for (const tooth of data.toothFindings) {
        this.checkNewPage(16)
        this.drawLine(0.3)
        this.y += 5

        this.page.drawText(tooth.toothNumber, { x: colX[0] + 4, y: this.y + 2, size: 9, font: this.fontBold, color: TEAL })

        // Truncate long text for table
        const dxText = (tooth.diagnosis || '-').substring(0, 25)
        const txText = (tooth.treatment || '-').substring(0, 25)
        const prText = tooth.priority || '-'

        this.page.drawText(dxText, { x: colX[1] + 4, y: this.y + 2, size: 8, font: this.fontRegular, color: DARK })
        this.page.drawText(txText, { x: colX[2] + 4, y: this.y + 2, size: 8, font: this.fontRegular, color: DARK })
        this.page.drawText(prText, { x: colX[3] + 4, y: this.y + 2, size: 8, font: this.fontRegular, color: DARK })

        this.y -= 14
      }
    }

    // ═══ PRESCRIPTIONS ═══
    if (data.prescriptions.length > 0) {
      this.drawSectionHeader('Prescriptions')

      for (let i = 0; i < data.prescriptions.length; i++) {
        const rx = data.prescriptions[i]
        this.checkNewPage(30)
        this.drawText(`${i + 1}. ${rx.name}`, { size: 10, font: this.fontBold })
        this.drawKeyValue('Dosage', rx.dosage, 15)
        this.drawKeyValue('Frequency', rx.frequency, 15)
        this.drawKeyValue('Duration', rx.duration, 15)
        if (rx.instructions) this.drawKeyValue('Instructions', rx.instructions, 15)
        this.y -= 5
      }
    }

    // ═══ CLINICAL IMAGES (Session 12) ═══
    if (data.clinicalImages && data.clinicalImages.length > 0) {
      this.drawSectionHeader('Clinical Images')

      for (const img of data.clinicalImages) {
        try {
          this.checkNewPage(200) // Need space for image + caption

          // Fetch image bytes
          const response = await fetch(img.url)
          if (!response.ok) {
            this.drawText(`[Image unavailable: ${img.type} - ${img.description}]`, { size: 8, color: GRAY })
            continue
          }

          const imageBytes = new Uint8Array(await response.arrayBuffer())
          const mimeType = img.mimeType || response.headers.get('content-type') || 'image/jpeg'

          // Embed image based on type
          let embeddedImage
          if (mimeType.includes('png')) {
            embeddedImage = await this.doc.embedPng(imageBytes)
          } else {
            embeddedImage = await this.doc.embedJpg(imageBytes)
          }

          // Scale to fit content width, max height 250px
          const aspectRatio = embeddedImage.width / embeddedImage.height
          let drawWidth = Math.min(CONTENT_WIDTH, 400)
          let drawHeight = drawWidth / aspectRatio
          if (drawHeight > 250) {
            drawHeight = 250
            drawWidth = drawHeight * aspectRatio
          }

          // Check if we need a new page for this image
          if (this.y - drawHeight - 30 < MARGIN) {
            this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
            this.pageCount++
            this.y = PAGE_HEIGHT - MARGIN
          }

          // Draw image
          this.page.drawImage(embeddedImage, {
            x: MARGIN,
            y: this.y - drawHeight,
            width: drawWidth,
            height: drawHeight,
          })
          this.y -= drawHeight + 5

          // Caption
          this.drawText(`${img.type}: ${img.description}`, { size: 8, color: GRAY })
          this.y -= 10

        } catch (imgErr) {
          console.error(`[REPORT] Failed to embed image:`, imgErr)
          this.drawText(`[Failed to embed ${img.type} image]`, { size: 8, color: GRAY })
        }
      }
    }

    // ═══ FOLLOW-UP ═══
    if (data.followUp) {
      this.drawSectionHeader('Follow-Up Plan')
      if (data.followUp.plan) this.drawKeyValue('Plan', data.followUp.plan)
      if (data.followUp.nextAppointmentDate) this.drawKeyValue('Next Appointment', data.followUp.nextAppointmentDate)
      if (data.followUp.instructions) this.drawKeyValue('Instructions', data.followUp.instructions)
    }

    // ═══ TRANSCRIPT (if included, on new page) ═══
    if (data.transcript && data.transcript.length > 0) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      this.pageCount++
      this.y = PAGE_HEIGHT - MARGIN
      this.drawSectionHeader('Consultation Transcript')
      this.drawText(data.transcript, { size: 8, color: GRAY })
    }

    // ═══ FOOTER ON ALL PAGES ═══
    const pages = this.doc.getPages()
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i]

      // Signature line on last content page (before transcript)
      if (i === (data.transcript ? pages.length - 2 : pages.length - 1)) {
        p.drawLine({
          start: { x: PAGE_WIDTH - MARGIN - 150, y: MARGIN + 40 },
          end: { x: PAGE_WIDTH - MARGIN, y: MARGIN + 40 },
          thickness: 0.5,
          color: DARK,
        })
        p.drawText('Dentist Signature', {
          x: PAGE_WIDTH - MARGIN - 120,
          y: MARGIN + 28,
          size: 8,
          font: this.fontRegular,
          color: GRAY,
        })
      }

      // Page number
      p.drawText(`Page ${i + 1} of ${pages.length}`, {
        x: PAGE_WIDTH / 2 - 25,
        y: 20,
        size: 8,
        font: this.fontRegular,
        color: GRAY,
      })

      // Footer line
      p.drawLine({
        start: { x: MARGIN, y: MARGIN - 5 },
        end: { x: PAGE_WIDTH - MARGIN, y: MARGIN - 5 },
        thickness: 0.3,
        color: LIGHT_GRAY,
      })

      p.drawText('Generated by EndoFlow AI', {
        x: MARGIN,
        y: 20,
        size: 7,
        font: this.fontRegular,
        color: GRAY,
      })
    }

    return this.doc.save()
  }
}

/**
 * Generate a consultation report PDF
 */
export async function generateConsultationReport(data: ReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  const builder = new PDFReportBuilder(doc, page)
  return builder.build(data)
}
