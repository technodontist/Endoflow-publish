import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserCheck, Stethoscope, Database, CheckCircle, AlertTriangle } from "lucide-react"

export default function AdminGuidePage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">ENDOFLOW Admin Guide</h1>
        <p className="text-muted-foreground">
          How to manage dentists, assistants, and system configuration
        </p>
      </div>

      <div className="grid gap-6">
        {/* Quick Fix Summary */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Quick Fix Implementation Complete
            </CardTitle>
            <CardDescription>
              Public signup is now patient-only. Staff management through Supabase Dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-green-800 mb-2">✅ What's Working:</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Patient-only public registration</li>
                  <li>• Dr. Nisarg login working</li>
                  <li>• Assistant patient approval workflow</li>
                  <li>• Simplified, secure signup process</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-green-800 mb-2">🎯 Benefits:</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• More secure (no public staff access)</li>
                  <li>• Simpler user experience</li>
                  <li>• Admin control over staff accounts</li>
                  <li>• Production-ready authentication</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Adding Dentists */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-purple-600" />
              Adding Dentists
            </CardTitle>
            <CardDescription>
              How to create dentist accounts through Supabase Dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">Step-by-Step Process:</h4>
              <ol className="text-sm text-blue-700 space-y-2">
                <li>1. Go to <strong>Supabase Dashboard</strong> → Your Project → <strong>Authentication</strong> → <strong>Users</strong></li>
                <li>2. Click <strong>"Add user"</strong> → <strong>"Create a new user"</strong></li>
                <li>3. Fill in details:
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>• Email: <code>dr.example@endoflow.com</code></li>
                    <li>• Password: <code>endoflow123</code> (or custom)</li>
                    <li>• <strong>Check "Auto Confirm User"</strong></li>
                  </ul>
                </li>
                <li>4. Add User Metadata:
                  <pre className="bg-blue-100 p-2 rounded text-xs mt-1">
{`{
  "full_name": "Dr. Example Name",
  "role": "dentist"
}`}
                  </pre>
                </li>
                <li>5. Click <strong>"Create user"</strong></li>
              </ol>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold text-amber-800 mb-2">After Creating User:</h4>
              <ol className="text-sm text-amber-700 space-y-1">
                <li>1. Go to <strong>Table Editor</strong> → <strong>profiles</strong> table</li>
                <li>2. Find the new user and update:
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>• role: <Badge variant="secondary">dentist</Badge></li>
                    <li>• status: <Badge variant="default">active</Badge></li>
                  </ul>
                </li>
                <li>3. Add entry to <strong>api.dentists</strong> table with same ID and specialty</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Adding Assistants */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-600" />
              Adding Assistants
            </CardTitle>
            <CardDescription>
              Similar process for dental assistant accounts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-800 mb-2">Quick Steps:</h4>
              <ol className="text-sm text-green-700 space-y-1">
                <li>1. Create user in Authentication with <code>role: "assistant"</code></li>
                <li>2. Update profiles table: <code>role = assistant, status = active</code></li>
                <li>3. Add entry to <strong>api.assistants</strong> table</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Database Schema Fix */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              Database Schema Status
            </CardTitle>
            <CardDescription>
              Current schema issues and manual fixes needed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <h4 className="font-semibold text-red-800">Missing Columns in api.patients</h4>
              </div>
              <p className="text-sm text-red-700 mb-3">
                The following columns need to be added manually via SQL Editor:
              </p>
              <pre className="bg-red-100 p-3 rounded text-xs font-mono">
{`ALTER TABLE api.patients
ADD COLUMN phone TEXT,
ADD COLUMN email TEXT,
ADD COLUMN emergency_contact_name TEXT,
ADD COLUMN emergency_contact_phone TEXT;`}
              </pre>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">To Fix Schema:</h4>
              <ol className="text-sm text-blue-700 space-y-1">
                <li>1. Go to <strong>Supabase Dashboard</strong> → <strong>SQL Editor</strong></li>
                <li>2. Run the SQL command above</li>
                <li>3. Test patient registration and search functionality</li>
                <li>4. Visit <code>/debug-schema</code> page to verify fixes</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Testing & Verification */}
        <Card>
          <CardHeader>
            <CardTitle>Testing the System</CardTitle>
            <CardDescription>
              How to verify everything is working correctly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">✅ Patient Flow:</h4>
                <ol className="text-sm space-y-1">
                  <li>1. Visit <code>/signup</code></li>
                  <li>2. Register as patient</li>
                  <li>3. Check assistant dashboard for approval</li>
                  <li>4. Approve patient</li>
                  <li>5. Test patient login</li>
                </ol>
              </div>
              <div>
                <h4 className="font-semibold mb-2">✅ Staff Flow:</h4>
                <ol className="text-sm space-y-1">
                  <li>1. Create user via Supabase</li>
                  <li>2. Update profiles table</li>
                  <li>3. Test staff login</li>
                  <li>4. Verify dashboard access</li>
                  <li>5. Test patient management</li>
                </ol>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold mb-2">🔧 Debug Tools:</h4>
              <ul className="text-sm space-y-1">
                <li>• <code>/debug-schema</code> - Test database schema and authentication</li>
                <li>• <code>/assistant/verify</code> - Patient approval interface</li>
                <li>• <code>/assistant/register</code> - Manual patient registration</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Current Credentials */}
        <Card>
          <CardHeader>
            <CardTitle>Current Working Credentials</CardTitle>
            <CardDescription>
              Accounts that should be working right now
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-2">Dr. Nisarg (Working)</h4>
                <div className="text-sm text-green-700 font-mono">
                  <div>Email: dr.nisarg@endoflow.com</div>
                  <div>Password: endoflow123</div>
                  <div>Role: dentist</div>
                  <div>Status: active</div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">Dr. Pranav (May Need Fix)</h4>
                <div className="text-sm text-blue-700 font-mono">
                  <div>Email: dr.pranav@endoflow.com</div>
                  <div>Password: endoflow123</div>
                  <div>Status: Check Supabase</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 text-center">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">
            This guide reflects the <strong>Quick Fix</strong> implementation where public signup is patient-only
            and staff accounts are managed through Supabase Dashboard for security.
          </p>
        </div>
      </div>
    </div>
  )
}