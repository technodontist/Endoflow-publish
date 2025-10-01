'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react"

export default function DebugSchemaPage() {
  const [results, setResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState<string | null>(null)

  async function runSchemaAnalysis() {
    setIsLoading(true)
    setCurrentStep('Analyzing schema')

    try {
      const response = await fetch('/api/fix-patients-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()
      setResults((prev: any) => ({ ...prev, schemaAnalysis: data }))
      console.log('Schema Analysis:', data)
    } catch (error) {
      console.error('Schema analysis failed:', error)
      setResults((prev: any) => ({ ...prev, schemaAnalysis: { success: false, error: String(error) } }))
    }

    setCurrentStep(null)
    setIsLoading(false)
  }

  async function runAuthFix() {
    setIsLoading(true)
    setCurrentStep('Fixing authentication')

    try {
      const response = await fetch('/api/fix-auth-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()
      setResults((prev: any) => ({ ...prev, authFix: data }))
      console.log('Auth Fix:', data)
    } catch (error) {
      console.error('Auth fix failed:', error)
      setResults((prev: any) => ({ ...prev, authFix: { success: false, error: String(error) } }))
    }

    setCurrentStep(null)
    setIsLoading(false)
  }

  async function runCompleteTest() {
    setIsLoading(true)
    setCurrentStep('Running complete workflow test')

    try {
      const response = await fetch('/api/test-complete-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()
      setResults((prev: any) => ({ ...prev, workflowTest: data }))
      console.log('Workflow Test:', data)
    } catch (error) {
      console.error('Workflow test failed:', error)
      setResults((prev: any) => ({ ...prev, workflowTest: { success: false, error: String(error) } }))
    }

    setCurrentStep(null)
    setIsLoading(false)
  }

  async function runAllFixes() {
    setResults(null)
    await runSchemaAnalysis()
    await runAuthFix()
    await runCompleteTest()
  }

  const renderResult = (result: any, title: string) => {
    if (!result) return null

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            {title}
            <Badge variant={result.success ? "default" : "destructive"}>
              {result.success ? 'Success' : 'Failed'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm font-medium">{result.message}</p>

            {result.manual_steps_required && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">Manual Steps Required</span>
                </div>
                <div className="text-sm text-amber-700 space-y-1">
                  {result.manual_steps_required.map((step: string, i: number) => (
                    <div key={i} className="font-mono text-xs bg-amber-100 p-2 rounded">
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.credentials && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm font-semibold text-blue-800 mb-2">Login Credentials</div>
                <div className="text-sm text-blue-700 space-y-1">
                  <div>Dr. Nisarg: {result.credentials.nisarg}</div>
                  <div>Dr. Pranav: {result.credentials.pranav}</div>
                </div>
              </div>
            )}

            {result.next_steps && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-sm font-semibold text-green-800 mb-2">Next Steps</div>
                <div className="text-sm text-green-700 space-y-1">
                  {result.next_steps.map((step: string, i: number) => (
                    <div key={i}>{step}</div>
                  ))}
                </div>
              </div>
            )}

            {result.errors && result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-sm font-semibold text-red-800 mb-2">Errors</div>
                <div className="text-sm text-red-700 space-y-1">
                  {result.errors.map((error: string, i: number) => (
                    <div key={i}>• {error}</div>
                  ))}
                </div>
              </div>
            )}

            <details className="mt-4">
              <summary className="text-sm font-medium cursor-pointer">View Raw Response</summary>
              <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Database Schema & Auth Debug Tool</h1>
        <p className="text-muted-foreground">
          Fix missing columns in api.patients table and resolve Dr. Nisarg authentication issues
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Button
          onClick={runSchemaAnalysis}
          disabled={isLoading}
          variant="outline"
        >
          1. Check Schema
        </Button>

        <Button
          onClick={runAuthFix}
          disabled={isLoading}
          variant="outline"
        >
          2. Fix Auth Users
        </Button>

        <Button
          onClick={runCompleteTest}
          disabled={isLoading}
          variant="outline"
        >
          3. Test Workflow
        </Button>

        <Button
          onClick={runAllFixes}
          disabled={isLoading}
          className="bg-teal-600 hover:bg-teal-700"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {currentStep || 'Running...'}
            </>
          ) : (
            'Run All Fixes'
          )}
        </Button>
      </div>

      <div className="space-y-4">
        {renderResult(results?.schemaAnalysis, 'Schema Analysis')}
        {renderResult(results?.authFix, 'Authentication Fix')}
        {renderResult(results?.workflowTest, 'Complete Workflow Test')}
      </div>
    </div>
  )
}