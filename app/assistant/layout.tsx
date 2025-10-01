'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EndoflowLogoCompact, EndoflowLogo } from '@/components/ui/endoflow-logo'
import {
  Home,
  Calendar,
  Users,
  FileUp,
  Bell,
  Settings,
  LogOut,
  Activity,
  Shield
} from 'lucide-react'

export default function AssistantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const navigation = [
    {
      name: 'Daily Task Hub',
      href: '/assistant',
      icon: Home,
      current: pathname === '/assistant'
    },
    {
      name: 'Register Patient',
      href: '/assistant/register',
      icon: Users,
      current: pathname.startsWith('/assistant/register')
    },
    {
      name: 'Patients',
      href: '/assistant/verify',
      icon: Activity,
      current: pathname.startsWith('/assistant/verify')
    },
    {
      name: 'New Appointment',
      href: '/assistant/appointments',
      icon: Calendar,
      current: pathname.startsWith('/assistant/appointments')
    },
    {
      name: 'File Uploader',
      href: '/assistant/files',
      icon: FileUp,
      current: pathname.startsWith('/assistant/files')
    },
    {
      name: 'Password Reset',
      href: '/assistant/passwords',
      icon: Shield,
      current: pathname.startsWith('/assistant/passwords')
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50">
      {/* V0 Design Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-teal-100/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo Section */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <EndoflowLogo size="2xl" showText={false} />
                <span className="text-2xl font-semibold text-teal-700">ENDOFLOW</span>
              </div>
              <div className="hidden sm:flex items-center">
                <Badge variant="secondary" className="bg-teal-100 text-teal-800 border-teal-200">
                  Assistant Portal
                </Badge>
              </div>
            </div>

            {/* Center Navigation - V0 Style */}
            <nav className="hidden xl:flex items-center space-x-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-all duration-200
                    ${item.current
                      ? 'bg-teal-100 text-teal-700 shadow-sm border border-teal-200'
                      : 'text-gray-600 hover:text-teal-700 hover:bg-teal-50/50'
                    }
                  `}
                >
                  <item.icon className="h-3 w-3" />
                  <span className="hidden 2xl:inline">{item.name}</span>
                  <span className="xl:inline 2xl:hidden">{item.name.split(' ')[0]}</span>
                </Link>
              ))}
            </nav>
            
            {/* Large screens navigation - show on lg but hide on xl */}
            <nav className="hidden lg:flex xl:hidden items-center space-x-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-all duration-200
                    ${item.current
                      ? 'bg-teal-100 text-teal-700 shadow-sm border border-teal-200'
                      : 'text-gray-600 hover:text-teal-700 hover:bg-teal-50/50'
                    }
                  `}
                >
                  <item.icon className="h-3 w-3" />
                </Link>
              ))}
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-[10px] text-white font-bold">2</span>
                </span>
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
              <Button asChild variant="outline" size="sm" className="border-teal-200 text-teal-700 hover:bg-teal-50">
                <Link href="/logout" className="flex items-center gap-1">
                  <LogOut className="h-3 w-3" />
                  Logout
                </Link>
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="lg:hidden border-t border-gray-100 pt-2 pb-3">
            <div className="flex items-center justify-between space-x-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs transition-all duration-200
                    ${item.current
                      ? 'bg-teal-100 text-teal-700'
                      : 'text-gray-600 hover:text-teal-700 hover:bg-teal-50/50'
                    }
                  `}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="font-medium">{item.name.split(' ')[0]}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with V0 styling */}
      <main className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-cyan-500/5 pointer-events-none" />
        <div className="relative">
          {children}
        </div>
      </main>
    </div>
  )
}