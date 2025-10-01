'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { Bell, LogOut, User, Settings, Home, Calendar, FileUp, UserPlus, Activity, Search } from 'lucide-react';
import { logout } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/client';
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EndoflowLogo } from "@/components/ui/endoflow-logo";

interface AssistantLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { id: "daily-tasks", label: "Daily Task Hub", icon: Home, href: "/assistant" },
  { id: "register-patient", label: "Register Patient", icon: UserPlus, href: "/assistant/register-patient" },
  { id: "file-uploader", label: "File Uploader", icon: FileUp, href: "/assistant/file-uploader" },
  { id: "new-appointment", label: "New Appointment", icon: Calendar, href: "/assistant/new-appointment" },
  { id: "treatments", label: "Treatments", icon: Activity, href: "/assistant/treatments" },
];

export function AssistantLayout({ children }: AssistantLayoutProps) {
  const [assistantData, setAssistantData] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    loadAssistantData();
  }, []);

  const loadAssistantData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .eq('role', 'assistant')
        .single();

      if (profile) {
        setAssistantData({
          id: profile.id,
          name: profile.full_name || 'Assistant'
        });
      }
    } catch (error) {
      console.error('Error loading assistant data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <EndoflowLogo size="md" showText={false} />
            <div>
              <h1 className="text-xl font-bold text-teal-600">ENDOFLOW</h1>
              <p className="text-sm text-gray-600">Assistant Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm">
              <Search className="w-4 h-4 mr-2" />
              Quick Search
            </Button>

            {/* Notification Center */}
            {assistantData && (
              <NotificationCenter userId={assistantData.id} role="assistant" />
            )}

            {/* Enhanced User Menu */}
            <div className="relative">
              <Button
                variant="ghost"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-teal-600" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium">{assistantData?.name || 'Loading...'}</div>
                  <div className="text-xs text-gray-500">Clinical Assistant</div>
                </div>
              </Button>

              {showProfileMenu && (
                <div className="absolute right-0 top-12 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setShowProfileMenu(false)}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Navigation Tabs */}
        <nav className="mt-4 border-t pt-4">
          <div className="flex space-x-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.id} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={`flex items-center gap-2 ${
                      isActive
                        ? "bg-teal-600 text-white hover:bg-teal-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                    size="sm"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {children}
      </main>
    </div>
  );
}