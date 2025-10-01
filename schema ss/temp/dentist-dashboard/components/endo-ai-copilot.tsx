"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Lightbulb, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface EndoAICopilotProps {
  toothNumber?: string
  diagnosis?: string
  treatments?: string
  className?: string
}

interface AISuggestion {
  treatment: string
  confidence: number
  reasoning: string
  sources: {
    title: string
    journal: string
    year: number
    url: string
  }[]
}

export function EndoAICopilot({ toothNumber, diagnosis, treatments, className }: EndoAICopilotProps) {
  // Mock AI suggestions based on tooth and diagnosis
  const getSuggestions = (): AISuggestion[] => {
    if (diagnosis?.toLowerCase().includes("caries")) {
      return [
        {
          treatment: "Composite Restoration with Selective Caries Removal",
          confidence: 92,
          reasoning:
            "Based on the location and extent of caries, selective caries removal followed by composite restoration shows optimal outcomes with minimal tooth structure loss.",
          sources: [
            {
              title: "Selective Caries Removal in Deep Lesions",
              journal: "Journal of Endodontics",
              year: 2023,
              url: "#",
            },
            {
              title: "Modern Approaches to Caries Management",
              journal: "International Dental Journal",
              year: 2022,
              url: "#",
            },
          ],
        },
      ]
    }

    if (diagnosis?.toLowerCase().includes("pulpitis")) {
      return [
        {
          treatment: "Root Canal Treatment with Rotary Instrumentation",
          confidence: 88,
          reasoning:
            "Irreversible pulpitis in posterior teeth shows excellent success rates with modern rotary techniques and bioceramic sealers.",
          sources: [
            {
              title: "Success Rates of Modern Endodontic Treatment",
              journal: "Endodontic Topics",
              year: 2023,
              url: "#",
            },
          ],
        },
      ]
    }

    return [
      {
        treatment: "Comprehensive Clinical Examination Required",
        confidence: 95,
        reasoning:
          "Thorough clinical and radiographic examination is recommended to establish accurate diagnosis and treatment plan.",
        sources: [
          {
            title: "Evidence-Based Endodontic Diagnosis",
            journal: "Journal of Endodontics",
            year: 2023,
            url: "#",
          },
        ],
      },
    ]
  }

  const suggestions = getSuggestions()

  return (
    <Alert className={`border-blue-200 bg-blue-50 ${className}`}>
      <Lightbulb className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-800 flex items-center gap-2">
        Endo-AI Co-Pilot
        <Badge variant="secondary" className="text-xs">
          Evidence-Based
        </Badge>
      </AlertTitle>
      <AlertDescription className="text-blue-700 space-y-3">
        {suggestions.map((suggestion, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-blue-800">{suggestion.treatment}</h4>
              <Badge variant="outline" className="text-xs">
                {suggestion.confidence}% confidence
              </Badge>
            </div>
            <p className="text-sm">{suggestion.reasoning}</p>
            <div className="space-y-1">
              <p className="text-xs font-medium text-blue-800">Evidence Sources:</p>
              {suggestion.sources.map((source, sourceIndex) => (
                <div key={sourceIndex} className="flex items-center gap-2 text-xs">
                  <ExternalLink className="h-3 w-3" />
                  <span>
                    {source.title} - <em>{source.journal}</em> ({source.year})
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </AlertDescription>
    </Alert>
  )
}
