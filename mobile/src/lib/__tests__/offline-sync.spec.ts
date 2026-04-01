import { OfflineSyncService } from '../offline-sync';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage');

describe('OfflineSyncService', () => {
  let syncService: OfflineSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    syncService = new OfflineSyncService();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([]);
  });

  describe('queue actions', () => {
    it('should queue an action', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const action = await syncService.queueAction({
        type: 'create',
        resource: 'task',
        resourceId: 'task-1',
        data: { title: 'New Task' },
      });

      expect(action).toBeDefined();
      expect(action.synced).toBe(false);
      expect(action.type).toBe('create');
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should preserve existing actions when queueing new one', async () => {
      const existingActions = JSON.stringify([
        {
          id: 'existing-1',
          type: 'create',
          resource: 'task',
          resourceId: 'task-1',
          data: { title: 'Task 1' },
          timestamp: Date.now(),
          synced: false,
        },
      ]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(existingActions);

      const action = await syncService.queueAction({
        type: 'update',
        resource: 'task',
        resourceId: 'task-2',
        data: { title: 'Task 2' },
      });

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        (call) => call[0] === 'nexora_offline_queue',
      );
      expect(setItemCall).toBeDefined();
    });
  });

  describe('pending actions', () => {
    it('should get pending actions', async () => {
      const queueData = JSON.stringify([
        {
          id: 'action-1',
          type: 'create',
          resource: 'task',
          resourceId: 'task-1',
          data: {},
          timestamp: Date.now(),
          synced: false,
        },
      ]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(queueData);

      const actions = await syncService.getPendingActions();

      expect(actions).toHaveLength(1);
      expect(actions[0].synced).toBe(false);
    });

    it('should filter out synced actions', async () => {
      const queueData = JSON.stringify([
        {
          id: 'action-1',
          type: 'create',
          resource: 'task',
          resourceId: 'task-1',
          data: {},
          timestamp: Date.now(),
          synced: true,
        },
        {
          id: 'action-2',
          type: 'create',
          resource: 'task',
          resourceId: 'task-2',
          data: {},
          timestamp: Date.now(),
          synced: false,
        },
      ]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(queueData);

      const actions = await syncService.getPendingActions();

      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe('action-2');
    });
  });

  describe('local data', () => {
    it('should save local data', async () => {
      const data = { title: 'Task', description: 'Description' };

      await syncService.saveLocalData('task', 'task-1', data);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'nexora_offline_task_task-1',
        JSON.stringify(data),
      );
    });

    it('should get local data', async () => {
      const data = { title: 'Task', description: 'Description' };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(data));

      const result = await syncService.getLocalData('task', 'task-1');

      expect(result).toEqual(data);
    });

    it('should delete local data', async () => {
      await syncService.deleteLocalData('task', 'task-1');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('nexora_offline_task_task-1');
    });

    it('should return null for missing local data', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await syncService.getLocalData('task', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('sync operations', () => {
    it('should mark action as synced', async () => {
      const queueData = JSON.stringify([
        {
          id: 'action-1',
          type: 'create',
          resource: 'task',
          resourceId: 'task-1',
          data: {},
          timestamp: Date.now(),
          synced: false,
        },
      ]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(queueData);

      await syncService.markAsSynced('action-1');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should clear synced actions', async () => {
      const queueData = JSON.stringify([
        {
          id: 'action-1',
          type: 'create',
          resource: 'task',
          resourceId: 'task-1',
          data: {},
          timestamp: Date.now(),
          synced: true,
        },
        {
          id: 'action-2',
          type: 'create',
          resource: 'task',
          resourceId: 'task-2',
          data: {},
          timestamp: Date.now(),
          synced: false,
        },
      ]);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(queueData);

      await syncService.clearSyncedActions();

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    it('should get storage stats', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify([
          {
            id: 'action-1',
            type: 'create',
            resource: 'task',
            resourceId: 'task-1',
            data: {},
            timestamp: Date.now(),
            synced: false,
          },
        ]),
      );

      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
        'nexora_offline_task_1',
        'nexora_offline_task_2',
      ]);

      const stats = await syncService.getStats();

      expect(stats.totalPendingActions).toBe(1);
      expect(stats.totalLocalData).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should clear all offline data', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue([
        'nexora_offline_task_1',
        'nexora_offline_queue',
      ]);

      await syncService.clearAllOfflineData();

      expect(AsyncStorage.multiRemove).toHaveBeenCalled();
    });
  });
});
