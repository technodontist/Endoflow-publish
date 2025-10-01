'use server';

import { revalidatePath } from 'next/cache';
import {
  getNotifications,
  markNotificationRead,
  createNotification
} from '@/lib/db/queries';

export async function getNotificationsAction(userId: string) {
  try {
    const notifications = await getNotifications(userId);
    return { success: true, data: notifications };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return { success: false, error: 'Failed to fetch notifications' };
  }
}

export async function markNotificationReadAction(notificationId: string) {
  try {
    const result = await markNotificationRead(notificationId);

    if (result.success) {
      // Revalidate pages that display notifications
      revalidatePath('/dashboard/patient');
      revalidatePath('/dashboard/assistant');
      revalidatePath('/dashboard/dentist');
    }

    return result;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: 'Failed to mark notification as read' };
  }
}

export async function createNotificationAction(
  userId: string,
  type: string,
  title: string,
  message: string,
  relatedId?: string
) {
  try {
    const result = await createNotification(userId, type, {
      title,
      message,
      relatedId
    });

    if (result.success) {
      // Revalidate pages that display notifications
      revalidatePath('/dashboard/patient');
      revalidatePath('/dashboard/assistant');
      revalidatePath('/dashboard/dentist');
    }

    return result;
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error: 'Failed to create notification' };
  }
}

export async function markAllNotificationsReadAction(userId: string) {
  try {
    const notifications = await getNotifications(userId);
    const unreadNotifications = notifications.filter(n => !n.read);

    const results = await Promise.all(
      unreadNotifications.map(notification =>
        markNotificationRead(notification.id)
      )
    );

    const allSuccessful = results.every(result => result.success);

    if (allSuccessful) {
      // Revalidate pages that display notifications
      revalidatePath('/dashboard/patient');
      revalidatePath('/dashboard/assistant');
      revalidatePath('/dashboard/dentist');
    }

    return {
      success: allSuccessful,
      markedCount: results.filter(r => r.success).length
    };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return { success: false, error: 'Failed to mark all notifications as read' };
  }
}

export async function getUnreadNotificationCountAction(userId: string) {
  try {
    const notifications = await getNotifications(userId);
    const unreadCount = notifications.filter(n => !n.read).length;
    return { success: true, count: unreadCount };
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return { success: false, error: 'Failed to get unread notification count' };
  }
}