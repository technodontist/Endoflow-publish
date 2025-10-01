'use client';

import { useState } from 'react';
import { Bell, Check, CheckCheck, X, Clock, AlertTriangle, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { Notification } from '@/lib/db/schema';

interface NotificationCenterProps {
  userId: string;
  role: 'patient' | 'assistant' | 'dentist';
}

export function NotificationCenter({ userId, role }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications(userId);

  const getNotificationIcon = (type: string) => {
    if (type.includes('emergency')) return <AlertTriangle className="w-4 h-4 text-red-500" />;
    if (type.includes('appointment')) return <Calendar className="w-4 h-4 text-blue-500" />;
    if (type.includes('patient') || type.includes('user')) return <User className="w-4 h-4 text-green-500" />;
    return <Bell className="w-4 h-4 text-gray-500" />;
  };

  const getNotificationPriority = (type: string): 'high' | 'medium' | 'low' => {
    if (type.includes('emergency')) return 'high';
    if (type.includes('urgent') || type.includes('appointment')) return 'medium';
    return 'low';
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-50';
      case 'medium': return 'border-l-orange-500 bg-orange-50';
      case 'low': return 'border-l-blue-500 bg-blue-50';
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Handle navigation based on notification type and role
    if (notification.type.includes('appointment') && notification.relatedId) {
      // Navigate to appointment details
      const baseUrl = role === 'patient' ? '/patient' :
                     role === 'assistant' ? '/assistant' : '/dentist';
      window.location.href = `${baseUrl}?appointment=${notification.relatedId}`;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative p-2"
          aria-label={`Notifications (${unreadCount} unread)`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {unreadCount} new
                  </Badge>
                )}
              </CardTitle>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs px-2 py-1 h-7"
                  >
                    <CheckCheck className="w-3 h-3 mr-1" />
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="p-1 h-7 w-7"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="h-96 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">
                  <Clock className="w-6 h-6 mx-auto mb-2 animate-spin" />
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No notifications yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    You'll see updates about appointments and system notifications here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => {
                    const priority = getNotificationPriority(notification.type);
                    const isUnread = !notification.read;

                    return (
                      <div
                        key={notification.id}
                        className={`p-4 border-l-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                          getPriorityColor(priority)
                        } ${isUnread ? 'bg-opacity-100' : 'bg-opacity-30'}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getNotificationIcon(notification.type)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className={`text-sm font-medium ${
                                isUnread ? 'text-gray-900' : 'text-gray-600'
                              }`}>
                                {notification.title}
                              </h4>
                              {isUnread && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                              )}
                            </div>

                            <p className={`text-sm ${
                              isUnread ? 'text-gray-700' : 'text-gray-500'
                            } line-clamp-2`}>
                              {notification.message}
                            </p>

                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-400">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                              </span>

                              {isUnread && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notification.id);
                                  }}
                                  className="text-xs px-2 py-1 h-6"
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}