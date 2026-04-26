import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: boolean;
}

/**
 * Route to the correct screen based on notification data
 */
function navigateFromNotificationData(data: Record<string, string> | undefined): void {
  if (!data) {
    router.push('/notifications');
    return;
  }

  const entityType = data.entityType || data.type;
  const entityId = data.entityId || data.referenceId;

  if (!entityId) {
    router.push('/notifications');
    return;
  }

  if (entityType === 'sprint' || entityType === 'project') {
    router.push(`/project/${data.projectId || entityId}`);
  } else {
    // task, comment, assignment, due_date, overdue, status, mention
    router.push(`/task/${entityId}`);
  }
}

/**
 * Push Notification Service for Mobile
 * Manages Firebase Cloud Messaging and local notifications
 */
export class MobilePushNotificationService {
  private isInitialized = false;

  /**
   * Initialize push notifications
   */
  async initialize(): Promise<void> {
    try {
      // Request permissions
      const { status } = await Notifications.getPermissionsAsync();

      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          console.warn('Push notification permission denied');
          return;
        }
      }

      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          };
        },
      });

      // Handle notification tap — navigate to relevant screen
      this.registerNotificationResponseHandler((response) => {
        const data = response.notification.request.content.data as Record<string, string> | undefined;
        navigateFromNotificationData(data);
      });

      // Register for push notifications
      const token = await this.getDeviceToken();
      if (token) {
        await this.saveDeviceToken(token);
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  /**
   * Get device push token
   */
  async getDeviceToken(): Promise<string | null> {
    try {
      const { data: token } = await Notifications.getExpoPushTokenAsync();
      return token;
    } catch (error) {
      console.error('Failed to get device token:', error);
      return null;
    }
  }

  /**
   * Save device token to storage and backend
   */
  async saveDeviceToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem('devicePushToken', token);
      // TODO: Send token to backend for FCM registration
    } catch (error) {
      console.error('Failed to save device token:', error);
    }
  }

  /**
   * Show local notification
   */
  async showNotification(notification: PushNotification): Promise<string | null> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          sound: notification.sound !== false,
          autoDismiss: true,
        },
        trigger: null, // Show immediately
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return null;
    }
  }

  /**
   * Schedule notification for later
   */
  async scheduleNotification(
    notification: PushNotification,
    triggerAt: Date,
  ): Promise<string | null> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          sound: notification.sound !== false,
        },
        trigger: {
          type: 'date' as const,
          timestamp: triggerAt.getTime(),
        },
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return null;
    }
  }

  /**
   * Register notification received handler
   */
  registerNotificationReceivedHandler(
    handler: (notification: Notifications.Notification) => void,
  ): () => void {
    const subscription = Notifications.addNotificationReceivedListener(handler);
    return () => subscription.remove();
  }

  /**
   * Register notification response handler (when user taps notification)
   */
  registerNotificationResponseHandler(
    handler: (response: Notifications.NotificationResponse) => void,
  ): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener(handler);
    return () => subscription.remove();
  }

  /**
   * Dismiss notification
   */
  async dismissNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.dismissNotificationAsync(notificationId);
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  }

  /**
   * Cancel scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }

  /**
   * Get all scheduled notifications
   */
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to get scheduled notifications:', error);
      return [];
    }
  }

  /**
   * Check if notifications are enabled
   */
  async isNotificationsEnabled(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Failed to check notification status:', error);
      return false;
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  }

  /**
   * Setup notification channels (Android)
   */
  async setupNotificationChannels(): Promise<void> {
    try {
      // Android specific setup
      if (require('react-native').Platform.OS === 'android') {
        // Configure notification channels for Android
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    } catch (error) {
      console.error('Failed to setup notification channels:', error);
    }
  }

  /**
   * Is service initialized
   */
  isInitialized(): boolean {
    return this.isInitialized;
  }
}

/**
 * Navigate to the correct screen from notification data.
 * Can be called from any component that receives notification data.
 */
export { navigateFromNotificationData };

// Singleton instance
let pushNotificationService: MobilePushNotificationService | null = null;

export const getMobilePushNotificationService = (): MobilePushNotificationService => {
  if (!pushNotificationService) {
    pushNotificationService = new MobilePushNotificationService();
  }
  return pushNotificationService;
};
