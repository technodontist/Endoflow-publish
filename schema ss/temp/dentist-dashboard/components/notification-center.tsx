"use client"

import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

interface Notification {
  id: string
  title: string
  message: string
  time: string
  type: "info" | "warning" | "success" | "error"
  read: boolean
}

interface NotificationCenterProps {
  notifications?: Notification[]
  unreadCount?: number
  onNotificationClick?: (notification: Notification) => void
  onMarkAllRead?: () => void
}

export function NotificationCenter({
  notifications = [
    {
      id: "1",
      title: "Appointment Reminder",
      message: "Patient John Doe has an appointment in 30 minutes",
      time: "2 min ago",
      type: "info",
      read: false,
    },
    {
      id: "2",
      title: "Lab Results Ready",
      message: "X-ray results for Sarah Johnson are available",
      time: "15 min ago",
      type: "success",
      read: false,
    },
    {
      id: "3",
      title: "Equipment Maintenance",
      message: "Dental chair #3 requires scheduled maintenance",
      time: "1 hour ago",
      type: "warning",
      read: true,
    },
  ],
  unreadCount = 2,
  onNotificationClick,
  onMarkAllRead,
}: NotificationCenterProps) {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return "✓"
      case "warning":
        return "⚠"
      case "error":
        return "✕"
      default:
        return "ℹ"
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "success":
        return "text-green-600"
      case "warning":
        return "text-yellow-600"
      case "error":
        return "text-red-600"
      default:
        return "text-blue-600"
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onMarkAllRead} className="text-xs h-auto p-1">
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">No notifications</div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className="flex flex-col items-start p-3 cursor-pointer"
              onClick={() => onNotificationClick?.(notification)}
            >
              <div className="flex items-start w-full gap-2">
                <span className={`text-sm ${getNotificationColor(notification.type)}`}>
                  {getNotificationIcon(notification.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-sm font-medium ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {notification.title}
                    </p>
                    {!notification.read && <div className="w-2 h-2 bg-primary rounded-full ml-2 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
