import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../hooks/useAuth';
import { getApiClient } from '../lib/api-client';
import { MainStackNavigationProp, MainStackRouteProp } from '../types/navigation';

interface DashboardScreenProps {
  navigation: MainStackNavigationProp;
  route: MainStackRouteProp<'HomeTabs'>;
}

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalProjects: number;
  activeProjects: number;
  recentTasks: any[];
  recentProjects: any[];
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const apiClient = getApiClient();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tasksResult, projectsResult] = await Promise.all([
        apiClient.getTasks({ limit: 100 }),
        apiClient.getProjects({ limit: 100 }),
      ]);

      const tasks = tasksResult || [];
      const projects = projectsResult || [];

      const now = new Date();
      const completedCount = tasks.filter((t) => t.status === 'done').length;
      const overdueCount = tasks.filter((t) => {
        if (!t.dueDate || t.status === 'done') return false;
        return new Date(t.dueDate) < now;
      }).length;

      const recentTasks = tasks.slice(0, 5);
      const recentProjects = projects.slice(0, 3);

      setStats({
        totalTasks: tasks.length,
        completedTasks: completedCount,
        overdueTasks: overdueCount,
        totalProjects: projects.length,
        activeProjects: projects.filter((p) => p.status === 'active').length,
        recentTasks,
        recentProjects,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  const getCompletionPercentage = (): number => {
    if (!stats || stats.totalTasks === 0) return 0;
    return Math.round((stats.completedTasks / stats.totalTasks) * 100);
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high':
        return '#ff6b6b';
      case 'medium':
        return '#ffd93d';
      case 'low':
        return '#6bcf7f';
      default:
        return '#999';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'done':
        return '#6bcf7f';
      case 'in-progress':
        return '#4ecdc4';
      case 'review':
        return '#667eea';
      case 'todo':
        return '#999';
      default:
        return '#999';
    }
  };

  return (
    <LinearGradient colors={['#f5f7fa', '#f5f7fa']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.firstName}! 👋</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.settingsButton}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadDashboardData}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        )}

        {/* Stats Cards */}
        {!isLoading && stats && (
          <>
            {/* Task Progress Card */}
            <View style={styles.cardSection}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.progressCard}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Task Progress</Text>
                  <Text style={styles.completionPercent}>{getCompletionPercentage()}%</Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${getCompletionPercentage()}%`,
                      },
                    ]}
                  />
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.completedTasks}</Text>
                    <Text style={styles.statLabel}>Completed</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.totalTasks}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.overdueTasks}</Text>
                    <Text style={styles.statLabel}>Overdue</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Projects Card */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Projects</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('HomeTabs', { screen: 'Projects' } as any)}
                >
                  <Text style={styles.viewAllLink}>View All</Text>
                </TouchableOpacity>
              </View>

              {stats.recentProjects.length > 0 ? (
                stats.recentProjects.map((project) => (
                  <TouchableOpacity
                    key={project._id}
                    style={styles.projectCard}
                    onPress={() =>
                      navigation.navigate('ProjectDetail', { projectId: project._id })
                    }
                  >
                    <View style={styles.projectCardContent}>
                      <Text style={styles.projectName}>{project.name}</Text>
                      <Text style={styles.projectStats}>
                        {project.taskCount} tasks • {project.memberCount} members
                      </Text>
                    </View>
                    <View style={styles.projectBadge}>
                      <Text
                        style={[
                          styles.projectStatus,
                          {
                            color:
                              project.status === 'active' ? '#6bcf7f' : '#999',
                          },
                        ]}
                      >
                        {project.status === 'active' ? '●' : '○'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No projects yet</Text>
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={() =>
                      navigation.navigate('HomeTabs', { screen: 'Projects' } as any)
                    }
                  >
                    <Text style={styles.createButtonText}>Create Project</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Recent Tasks Card */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Tasks</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('HomeTabs', { screen: 'Tasks' } as any)}
                >
                  <Text style={styles.viewAllLink}>View All</Text>
                </TouchableOpacity>
              </View>

              {stats.recentTasks.length > 0 ? (
                stats.recentTasks.map((task) => (
                  <TouchableOpacity
                    key={task._id}
                    style={styles.taskCard}
                    onPress={() => navigation.navigate('TaskDetail', { taskId: task._id })}
                  >
                    <View style={styles.taskCardContent}>
                      <View
                        style={[
                          styles.priorityIndicator,
                          { backgroundColor: getPriorityColor(task.priority) },
                        ]}
                      />
                      <View style={styles.taskInfo}>
                        <Text style={styles.taskTitle} numberOfLines={1}>
                          {task.title}
                        </Text>
                        <View style={styles.taskMetaRow}>
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: getStatusColor(task.status) + '20' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                { color: getStatusColor(task.status) },
                              ]}
                            >
                              {task.status}
                            </Text>
                          </View>
                          {task.dueDate && (
                            <Text style={styles.dueDate}>
                              {new Date(task.dueDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No tasks yet</Text>
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={() =>
                      navigation.navigate('CreateTask', { projectId: undefined })
                    }
                  >
                    <Text style={styles.createButtonText}>Create Task</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Quick Actions */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickActionsGrid}>
                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() =>
                    navigation.navigate('CreateTask', { projectId: undefined })
                  }
                >
                  <Text style={styles.quickActionIcon}>➕</Text>
                  <Text style={styles.quickActionLabel}>New Task</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() => navigation.navigate('HomeTabs', { screen: 'Projects' } as any)}
                >
                  <Text style={styles.quickActionIcon}>📁</Text>
                  <Text style={styles.quickActionLabel}>Projects</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() => navigation.navigate('Settings')}
                >
                  <Text style={styles.quickActionIcon}>⚙️</Text>
                  <Text style={styles.quickActionLabel}>Settings</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() => navigation.navigate('Profile')}
                >
                  <Text style={styles.quickActionIcon}>👤</Text>
                  <Text style={styles.quickActionLabel}>Profile</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    marginTop: 8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsIcon: {
    fontSize: 20,
  },
  cardSection: {
    marginBottom: 20,
  },
  progressCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  completionPercent: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  viewAllLink: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  projectCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  projectCardContent: {
    flex: 1,
  },
  projectName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  projectStats: {
    fontSize: 12,
    color: '#666',
  },
  projectBadge: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  projectStatus: {
    fontSize: 12,
    fontWeight: '700',
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  taskCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityIndicator: {
    width: 4,
    height: 60,
    borderRadius: 2,
    marginRight: 12,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  dueDate: {
    fontSize: 11,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  createButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffe0e0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#d32f2f',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});
