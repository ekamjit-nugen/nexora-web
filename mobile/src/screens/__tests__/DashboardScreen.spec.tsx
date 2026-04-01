import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { DashboardScreen } from '../DashboardScreen';
import * as ApiClient from '../../lib/api-client';
import { useAuth } from '../../hooks/useAuth';

jest.mock('../../hooks/useAuth');
jest.mock('../../lib/api-client');

describe('DashboardScreen', () => {
  const mockNavigate = jest.fn();
  const mockUser = {
    _id: 'user1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockTasks = [
    {
      _id: 'task1',
      title: 'Task 1',
      status: 'done',
      priority: 'high',
      projectId: 'proj1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: 'task2',
      title: 'Task 2',
      status: 'todo',
      priority: 'medium',
      projectId: 'proj1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockProjects = [
    {
      _id: 'proj1',
      name: 'Project 1',
      status: 'active',
      memberCount: 5,
      taskCount: 2,
      createdAt: new Date().toISOString(),
      ownerEmail: 'test@example.com',
    },
  ];

  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      isLoading: false,
      isAuthenticated: true,
      error: null,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
    });

    (ApiClient.getApiClient as jest.Mock).mockReturnValue({
      getTasks: jest.fn().mockResolvedValue(mockTasks),
      getProjects: jest.fn().mockResolvedValue(mockProjects),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render dashboard with greeting', async () => {
    const { getByText } = render(
      <DashboardScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{} as any}
      />
    );

    await waitFor(() => {
      expect(getByText(/Hello, John!/)).toBeTruthy();
    });
  });

  it('should display task progress card', async () => {
    const { getByText } = render(
      <DashboardScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{} as any}
      />
    );

    await waitFor(() => {
      expect(getByText('Task Progress')).toBeTruthy();
      expect(getByText('50%')).toBeTruthy(); // 1 completed out of 2
    });
  });

  it('should display recent projects', async () => {
    const { getByText } = render(
      <DashboardScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{} as any}
      />
    );

    await waitFor(() => {
      expect(getByText('Project 1')).toBeTruthy();
      expect(getByText(/2 tasks/)).toBeTruthy();
    });
  });

  it('should display recent tasks', async () => {
    const { getByText } = render(
      <DashboardScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{} as any}
      />
    );

    await waitFor(() => {
      expect(getByText('Recent Tasks')).toBeTruthy();
      expect(getByText('Task 1')).toBeTruthy();
    });
  });

  it('should navigate to project detail on project press', async () => {
    const { getByText } = render(
      <DashboardScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{} as any}
      />
    );

    await waitFor(() => {
      const projectButton = getByText('Project 1');
      fireEvent.press(projectButton);
      expect(mockNavigate).toHaveBeenCalledWith('ProjectDetail', { projectId: 'proj1' });
    });
  });

  it('should navigate to task detail on task press', async () => {
    const { getByText } = render(
      <DashboardScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{} as any}
      />
    );

    await waitFor(() => {
      const taskButton = getByText('Task 1');
      fireEvent.press(taskButton);
      expect(mockNavigate).toHaveBeenCalledWith('TaskDetail', { taskId: 'task1' });
    });
  });

  it('should show loading indicator initially', () => {
    const { getByText } = render(
      <DashboardScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{} as any}
      />
    );

    expect(getByText('Loading dashboard...')).toBeTruthy();
  });

  it('should handle refresh', async () => {
    const { getByA11yLabel } = render(
      <DashboardScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{} as any}
      />
    );

    await waitFor(() => {
      const refreshControl = getByA11yLabel('Double tap to refresh');
      fireEvent(refreshControl, 'onRefresh');
    });
  });

  it('should calculate completion percentage correctly', async () => {
    const { getByText } = render(
      <DashboardScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{} as any}
      />
    );

    await waitFor(() => {
      expect(getByText('50%')).toBeTruthy();
    });
  });

  it('should display overdue tasks count', async () => {
    const tasksWithOverdue = [
      ...mockTasks,
      {
        _id: 'task3',
        title: 'Overdue Task',
        status: 'todo',
        priority: 'high',
        dueDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        projectId: 'proj1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    (ApiClient.getApiClient as jest.Mock).mockReturnValue({
      getTasks: jest.fn().mockResolvedValue(tasksWithOverdue),
      getProjects: jest.fn().mockResolvedValue(mockProjects),
    });

    const { getByText } = render(
      <DashboardScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{} as any}
      />
    );

    await waitFor(() => {
      expect(getByText('1')).toBeTruthy(); // 1 overdue task
    });
  });
});
