'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Notification } from '@/lib/db/schema';

interface NotificationHookResult {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useNotifications(userId: string): NotificationHookResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Load initial notifications
  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .schema('api')
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading notifications:', error);
        setError('Failed to load notifications');
        return;
      }

      setNotifications(data || []);
      setError(null);
    } catch (err) {
      console.error('Exception loading notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [userId, supabase]);

  // Set up real-time subscription
  useEffect(() => {
    if (!userId) return;

    loadNotifications();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'api',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('Real-time notification update:', payload);

          if (payload.eventType === 'INSERT') {
            const newNotification = payload.new as Notification;
            setNotifications(prev => [newNotification, ...prev]);

            // Show browser notification if permission granted
            showBrowserNotification(newNotification);
          } else if (payload.eventType === 'UPDATE') {
            const updatedNotification = payload.new as Notification;
            setNotifications(prev =>
              prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setNotifications(prev => prev.filter(n => n.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, loadNotifications]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .schema('api')
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      // Update local state immediately for better UX
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (err) {
      console.error('Exception marking notification as read:', err);
    }
  }, [supabase]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .schema('api')
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return;
      }

      // Update local state immediately
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
    } catch (err) {
      console.error('Exception marking all notifications as read:', err);
    }
  }, [supabase, userId]);

  // Show browser notification
  const showBrowserNotification = useCallback((notification: Notification) => {
    if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
      const browserNotification = new window.Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.type.includes('emergency')
      });

      // Auto-close after 5 seconds (except emergency notifications)
      if (!notification.type.includes('emergency')) {
        setTimeout(() => browserNotification.close(), 5000);
      }
    }
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'default') {
      window.Notification.requestPermission();
    }
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isLoading,
    error
  };
}