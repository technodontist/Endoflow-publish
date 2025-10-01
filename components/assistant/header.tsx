"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Menu, Calendar, FileText, CheckSquare, UserPlus, Upload, Home, LogOut, Settings } from "lucide-react"
import { logoutAction } from "@/lib/actions/logout"
import { EndoflowLogo } from "@/components/ui/endoflow-logo"

const navigationItems = [
  { name: "Home", href: "/assistant", icon: Home },
  { name: "Daily Tasks", href: "/assistant", icon: CheckSquare },
  { name: "Register Patient", href: "/assistant/register", icon: UserPlus },
  { name: "File Uploader", href: "/assistant/files", icon: Upload },
  { name: "New Appointment", href: "/assistant/appointments", icon: Calendar },
  { name: "Treatments", href: "/assistant/treatments", icon: FileText },
  { name: "Settings", href: "/assistant/settings", icon: Settings },
]

export function AssistantHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <EndoflowLogo size="md" showText={false} />
            <span className="text-xl font-bold text-teal-600">ENDOFLOW</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-teal-600 transition-colors px-3 py-2 rounded-md hover:bg-teal-50"
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <form action={logoutAction}>
            <Button variant="ghost" size="sm" type="submit" className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </form>

          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t bg-card">
          <div className="container px-4 py-2">
            <nav className="flex flex-col gap-2">
              {navigationItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-3 text-sm font-medium p-3 rounded-lg hover:bg-accent transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}