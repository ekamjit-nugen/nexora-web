import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncStore } from './store';

export interface OfflineAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  resource: 'task' | 'project' | 'organization';
  resourceId: string;
  data: Record<string, any>;
  timestamp: number;
  synced: boolean;
}

const OFFLINE_QUEUE_KEY = 'nexora_offline_queue';
const OFFLINE_DATA_PREFIX = 'nexora_offline_';

/**
 * Offline Sync Service
 * Manages offline data storage and sync with backend
 */
export class OfflineSyncService {
  /**
   * Save action to offline queue
   */
  async queueAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'synced'>): Promise<OfflineAction> {
    try {
      const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      const queue: OfflineAction[] = queueJson ? JSON.parse(queueJson) : [];

      const offlineAction: OfflineAction = {
        ...action,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        synced: false,
      };

      queue.push(offlineAction);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

      // Update pending changes count
      useSyncStore.setState({ pendingChanges: queue.length });

      return offlineAction;
    } catch (error) {
      console.error('Failed to queue action:', error);
      throw error;
    }
  }

  /**
   * Get all pending actions
   */
  async getPendingActions(): Promise<OfflineAction[]> {
    try {
      const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      const queue: OfflineAction[] = queueJson ? JSON.parse(queueJson) : [];
      return queue.filter((action) => !action.synced);
    } catch (error) {
      console.error('Failed to get pending actions:', error);
      return [];
    }
  }

  /**
   * Mark action as synced
   */
  async markAsSynced(actionId: string): Promise<void> {
    try {
      const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      const queue: OfflineAction[] = queueJson ? JSON.parse(queueJson) : [];

      const updatedQueue = queue.map((action) =>
        action.id === actionId ? { ...action, synced: true } : action,
      );

      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));

      // Update pending changes count
      const pending = updatedQueue.filter((a) => !a.synced);
      useSyncStore.setState({ pendingChanges: pending.length });
    } catch (error) {
      console.error('Failed to mark action as synced:', error);
      throw error;
    }
  }

  /**
   * Clear completed actions
   */
  async clearSyncedActions(): Promise<void> {
    try {
      const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      const queue: OfflineAction[] = queueJson ? JSON.parse(queueJson) : [];

      const unsyncedQueue = queue.filter((action) => !action.synced);
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(unsyncedQueue));

      useSyncStore.setState({ pendingChanges: unsyncedQueue.length });
    } catch (error) {
      console.error('Failed to clear synced actions:', error);
      throw error;
    }
  }

  /**
   * Save local data
   */
  async saveLocalData(resource: string, resourceId: string, data: Record<string, any>): Promise<void> {
    try {
      const key = `${OFFLINE_DATA_PREFIX}${resource}_${resourceId}`;
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save local data:', error);
      throw error;
    }
  }

  /**
   * Get local data
   */
  async getLocalData(resource: string, resourceId: string): Promise<Record<string, any> | null> {
    try {
      const key = `${OFFLINE_DATA_PREFIX}${resource}_${resourceId}`;
      const dataJson = await AsyncStorage.getItem(key);
      return dataJson ? JSON.parse(dataJson) : null;
    } catch (error) {
      console.error('Failed to get local data:', error);
      return null;
    }
  }

  /**
   * Delete local data
   */
  async deleteLocalData(resource: string, resourceId: string): Promise<void> {
    try {
      const key = `${OFFLINE_DATA_PREFIX}${resource}_${resourceId}`;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to delete local data:', error);
      throw error;
    }
  }

  /**
   * Get all local data for a resource type
   */
  async getAllLocalData(resource: string): Promise<Record<string, Record<string, any>>> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const resourceKeys = allKeys.filter((key) => key.startsWith(`${OFFLINE_DATA_PREFIX}${resource}_`));

      const data: Record<string, Record<string, any>> = {};

      for (const key of resourceKeys) {
        const dataJson = await AsyncStorage.getItem(key);
        if (dataJson) {
          const resourceId = key.replace(`${OFFLINE_DATA_PREFIX}${resource}_`, '');
          data[resourceId] = JSON.parse(dataJson);
        }
      }

      return data;
    } catch (error) {
      console.error('Failed to get all local data:', error);
      return {};
    }
  }

  /**
   * Sync pending actions (should be called by sync engine)
   */
  async syncPendingActions(
    syncFn: (action: OfflineAction) => Promise<void>,
  ): Promise<{ synced: number; failed: number; errors: Error[] }> {
    const pendingActions = await this.getPendingActions();
    let synced = 0;
    let failed = 0;
    const errors: Error[] = [];

    useSyncStore.setState({ isSyncing: true });

    for (const action of pendingActions) {
      try {
        await syncFn(action);
        await this.markAsSynced(action.id);
        synced++;
      } catch (error) {
        failed++;
        if (error instanceof Error) {
          errors.push(error);
        }
        console.error(`Failed to sync action ${action.id}:`, error);
      }
    }

    useSyncStore.setState({ isSyncing: false });

    return { synced, failed, errors };
  }

  /**
   * Clear all offline data (for debugging/reset)
   */
  async clearAllOfflineData(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const offlineKeys = allKeys.filter(
        (key) => key.startsWith(OFFLINE_DATA_PREFIX) || key === OFFLINE_QUEUE_KEY,
      );

      await AsyncStorage.multiRemove(offlineKeys);
      useSyncStore.setState({ pendingChanges: 0 });
    } catch (error) {
      console.error('Failed to clear offline data:', error);
      throw error;
    }
  }

  /**
   * Get offline storage stats
   */
  async getStats(): Promise<{
    totalPendingActions: number;
    lastSyncTime: number | null;
    totalLocalData: number;
  }> {
    try {
      const queue = await this.getPendingActions();
      const allKeys = await AsyncStorage.getAllKeys();
      const localDataKeys = allKeys.filter((key) => key.startsWith(OFFLINE_DATA_PREFIX));

      return {
        totalPendingActions: queue.length,
        lastSyncTime: useSyncStore.getState().lastSyncTime,
        totalLocalData: localDataKeys.length,
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        totalPendingActions: 0,
        lastSyncTime: null,
        totalLocalData: 0,
      };
    }
  }
}

// Singleton instance
let syncService: OfflineSyncService | null = null;

export const getOfflineSyncService = (): OfflineSyncService => {
  if (!syncService) {
    syncService = new OfflineSyncService();
  }
  return syncService;
};
