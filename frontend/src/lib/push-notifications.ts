/**
 * Firebase Cloud Messaging Push Notification Service
 * Note: This is a framework implementation. Firebase config needed for production.
 */

export interface PushNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  actions?: Array<{
    action: string;
    title: string;
  }>;
  data?: Record<string, string>;
}

export interface PushNotificationOptions {
  maxAttempts?: number;
  retryDelay?: number;
}

export class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported = false;

  constructor() {
    this.isSupported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "Notification" in window;
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      console.warn("Push notifications not supported in this browser");
      return "denied";
    }

    if (Notification.permission !== "granted") {
      return Notification.requestPermission();
    }

    return Notification.permission;
  }

  /**
   * Register service worker for push notifications
   */
  async registerServiceWorker(scriptPath: string = "/sw.js"): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported) {
      console.warn("Service workers not supported");
      return null;
    }

    try {
      this.registration = await navigator.serviceWorker.register(scriptPath);
      console.log("Service Worker registered successfully");
      return this.registration;
    } catch (error) {
      console.error("Service Worker registration failed:", error);
      return null;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPushNotifications(publicKey: string): Promise<PushSubscription | null> {
    if (!this.registration) {
      throw new Error("Service worker not registered");
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey) as any,
      });

      console.log("Subscribed to push notifications");
      return subscription;
    } catch (error) {
      console.error("Failed to subscribe to push notifications:", error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPushNotifications(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        console.log("Unsubscribed from push notifications");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to unsubscribe:", error);
      return false;
    }
  }

  /**
   * Show local notification
   */
  async showNotification(
    notification: PushNotification,
    options?: PushNotificationOptions,
  ): Promise<void> {
    if (!this.isSupported) {
      console.warn("Notifications not supported");
      return;
    }

    const permission = await this.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission denied");
      return;
    }

    if (this.registration) {
      try {
        await this.registration.showNotification(notification.title, {
          body: notification.body,
          icon: notification.icon,
          badge: notification.badge,
          tag: notification.tag || "default",
          data: notification.data,
          requireInteraction: false,
        });
      } catch (error) {
        console.error("Failed to show notification:", error);
      }
    }
  }

  /**
   * Get current push subscription
   */
  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) {
      return null;
    }

    try {
      return await this.registration.pushManager.getSubscription();
    } catch (error) {
      console.error("Failed to get subscription:", error);
      return null;
    }
  }

  /**
   * Check if user is subscribed
   */
  async isSubscribed(): Promise<boolean> {
    const subscription = await this.getSubscription();
    return subscription !== null;
  }

  /**
   * Convert VAPID public key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

// Singleton instance
let notificationService: PushNotificationService | null = null;

export const getPushNotificationService = (): PushNotificationService => {
  if (!notificationService) {
    notificationService = new PushNotificationService();
  }
  return notificationService;
};

/**
 * React Hook for push notifications
 */
export const usePushNotifications = () => {
  const service = getPushNotificationService();

  const requestPermission = async () => {
    return service.requestPermission();
  };

  const registerServiceWorker = async (scriptPath?: string) => {
    return service.registerServiceWorker(scriptPath);
  };

  const subscribe = async (publicKey: string) => {
    return service.subscribeToPushNotifications(publicKey);
  };

  const unsubscribe = async () => {
    return service.unsubscribeFromPushNotifications();
  };

  const showNotification = async (
    notification: PushNotification,
    options?: PushNotificationOptions,
  ) => {
    return service.showNotification(notification, options);
  };

  const isSubscribed = async () => {
    return service.isSubscribed();
  };

  return {
    requestPermission,
    registerServiceWorker,
    subscribe,
    unsubscribe,
    showNotification,
    isSubscribed,
  };
};
