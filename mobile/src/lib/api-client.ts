import { getAuthService } from './auth-service';
import { getOfflineSyncService } from './offline-sync';

export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
  dueDate?: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  _id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  ownerEmail: string;
  memberCount: number;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  memberCount: number;
  createdAt: string;
}

/**
 * Mobile API Client
 * Handles all API requests with offline support
 */
export class MobileApiClient {
  private authService = getAuthService();
  private syncService = getOfflineSyncService();

  /**
   * Get all projects
   */
  async getProjects(params?: { page?: number; limit?: number }): Promise<Project[]> {
    try {
      const apiClient = this.authService.getApiClient();
      const response = await apiClient.get<{ data: Project[] }>('/projects', {
        params: params || { limit: 50 },
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      // Return cached data or empty array
      return [];
    }
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    try {
      const apiClient = this.authService.getApiClient();
      const response = await apiClient.get<{ data: Project }>(`/projects/${projectId}`);

      // Save to local cache
      await this.syncService.saveLocalData('project', projectId, response.data.data);

      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch project:', error);
      // Try to get cached data
      return (await this.syncService.getLocalData('project', projectId)) as Project | null;
    }
  }

  /**
   * Create new project
   */
  async createProject(data: {
    name: string;
    description?: string;
  }): Promise<Project | null> {
    try {
      const apiClient = this.authService.getApiClient();
      const response = await apiClient.post<{ data: Project }>('/projects', data);

      await this.syncService.saveLocalData('project', response.data.data._id, response.data.data);

      return response.data.data;
    } catch (error) {
      console.error('Failed to create project:', error);

      // Queue action for later sync
      await this.syncService.queueAction({
        type: 'create',
        resource: 'project',
        resourceId: `temp-${Date.now()}`,
        data,
      });

      return null;
    }
  }

  /**
   * Get all tasks
   */
  async getTasks(
    projectId?: string,
    params?: { page?: number; limit?: number; status?: string },
  ): Promise<Task[]> {
    try {
      const apiClient = this.authService.getApiClient();
      const endpoint = projectId ? `/projects/${projectId}/tasks` : '/tasks';
      const response = await apiClient.get<{ data: Task[] }>(endpoint, {
        params: params || { limit: 100 },
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      return [];
    }
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    try {
      const apiClient = this.authService.getApiClient();
      const response = await apiClient.get<{ data: Task }>(`/tasks/${taskId}`);

      await this.syncService.saveLocalData('task', taskId, response.data.data);

      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch task:', error);
      return (await this.syncService.getLocalData('task', taskId)) as Task | null;
    }
  }

  /**
   * Create new task
   */
  async createTask(data: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    dueDate?: string;
    projectId: string;
  }): Promise<Task | null> {
    try {
      const apiClient = this.authService.getApiClient();
      const response = await apiClient.post<{ data: Task }>('/tasks', data);

      await this.syncService.saveLocalData('task', response.data.data._id, response.data.data);

      return response.data.data;
    } catch (error) {
      console.error('Failed to create task:', error);

      // Queue action for later sync
      await this.syncService.queueAction({
        type: 'create',
        resource: 'task',
        resourceId: `temp-${Date.now()}`,
        data,
      });

      return null;
    }
  }

  /**
   * Update task
   */
  async updateTask(taskId: string, data: Partial<Task>): Promise<Task | null> {
    try {
      const apiClient = this.authService.getApiClient();
      const response = await apiClient.put<{ data: Task }>(`/tasks/${taskId}`, data);

      await this.syncService.saveLocalData('task', taskId, response.data.data);

      return response.data.data;
    } catch (error) {
      console.error('Failed to update task:', error);

      // Queue action for later sync
      await this.syncService.queueAction({
        type: 'update',
        resource: 'task',
        resourceId: taskId,
        data,
      });

      return null;
    }
  }

  /**
   * Delete task
   */
  async deleteTask(taskId: string): Promise<boolean> {
    try {
      const apiClient = this.authService.getApiClient();
      await apiClient.delete(`/tasks/${taskId}`);

      await this.syncService.deleteLocalData('task', taskId);

      return true;
    } catch (error) {
      console.error('Failed to delete task:', error);

      // Queue action for later sync
      await this.syncService.queueAction({
        type: 'delete',
        resource: 'task',
        resourceId: taskId,
        data: {},
      });

      return false;
    }
  }

  /**
   * Get organization info
   */
  async getOrganization(): Promise<Organization | null> {
    try {
      const apiClient = this.authService.getApiClient();
      const response = await apiClient.get<{ data: Organization }>('/organizations/current');

      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch organization:', error);
      return null;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, status: Task['status']): Promise<Task | null> {
    return this.updateTask(taskId, { status } as any);
  }

  /**
   * Batch fetch tasks
   */
  async fetchTasksBatch(projectIds: string[]): Promise<Record<string, Task[]>> {
    const result: Record<string, Task[]> = {};

    for (const projectId of projectIds) {
      try {
        result[projectId] = await this.getTasks(projectId);
      } catch (error) {
        console.error(`Failed to fetch tasks for project ${projectId}:`, error);
        result[projectId] = [];
      }
    }

    return result;
  }
}

// Singleton instance
let apiClient: MobileApiClient | null = null;

export const getMobileApiClient = (): MobileApiClient => {
  if (!apiClient) {
    apiClient = new MobileApiClient();
  }
  return apiClient;
};
