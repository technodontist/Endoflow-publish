export const dynamic = 'force-dynamic'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Shield } from "lucide-react"
import Link from "next/link"
import { PasswordManagement } from "@/components/password-management"

export default function PasswordManagementPage() {
  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/assistant" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Password Management</h1>
            <p className="text-muted-foreground">Reset passwords and manage patient credentials</p>
          </div>
        </div>

        {/* Password Management */}
        <div className="max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Patient Password Tools</h2>
                  <p className="text-sm text-muted-foreground">Generate new passwords or send reset emails to patients</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PasswordManagement />
            </CardContent>
          </Card>
        </div>

        {/* Security Guidelines */}
        <div className="max-w-4xl">
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-amber-800">Security Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-amber-800 space-y-2">
              <p><strong>When to use these tools:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Patient forgot their password and needs immediate access</li>
                <li>Patient is having trouble with the self-service password reset</li>
                <li>Initial login issues for newly registered patients</li>
              </ul>

              <p className="pt-3"><strong>Security best practices:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Always verify patient identity before resetting passwords</li>
                <li>Share temporary passwords through secure channels only</li>
                <li>Encourage patients to change passwords immediately after login</li>
                <li>Document password resets in patient notes when required</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}