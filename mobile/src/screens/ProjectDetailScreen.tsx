import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { getApiClient } from '../lib/api-client';
import { MainStackNavigationProp, MainStackRouteProp } from '../types/navigation';

interface ProjectDetailScreenProps {
  navigation: MainStackNavigationProp;
  route: MainStackRouteProp<'ProjectDetail'>;
}

interface Project {
  _id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  memberCount: number;
  taskCount: number;
  createdAt: string;
  ownerEmail: string;
}

interface Task {
  _id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
}

export const ProjectDetailScreen: React.FC<ProjectDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { projectId } = route.params;
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = getApiClient();

  useEffect(() => {
    loadProjectDetails();
  }, [projectId]);

  const loadProjectDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [projectResult, tasksResult] = await Promise.all([
        apiClient.getProject(projectId),
        apiClient.getTasks({ limit: 100 }),
      ]);

      setProject(projectResult || null);
      // Filter tasks for this project
      const projectTasks = (tasksResult || []).filter(
        (t) => t.projectId === projectId
      );
      setTasks(projectTasks);
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadProjectDetails();
    setIsRefreshing(false);
  };

  const getTaskStats = () => {
    if (tasks.length === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const completed = tasks.filter((t) => t.status === 'done').length;
    const percentage = Math.round((completed / tasks.length) * 100);

    return {
      completed,
      total: tasks.length,
      percentage,
    };
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

  const getTasksByStatus = (status: string) => {
    return tasks.filter((t) => t.status === status);
  };

  const stats = getTaskStats();

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
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={2}>
            {project?.name || 'Project'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadProjectDetails}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading project...</Text>
          </View>
        )}

        {/* Project Info Card */}
        {!isLoading && project && (
          <>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        project.status === 'active' ? '#e8f5e9' : '#f5f5f5',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color:
                          project.status === 'active' ? '#2e7d32' : '#666',
                      },
                    ]}
                  >
                    {project.status}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Members</Text>
                <Text style={styles.infoValue}>{project.memberCount}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tasks</Text>
                <Text style={styles.infoValue}>{project.taskCount}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoValue}>
                  {new Date(project.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </View>

            {project.description && (
              <View style={styles.descriptionCard}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.descriptionText}>{project.description}</Text>
              </View>
            )}

            {/* Task Progress Card */}
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.sectionTitle}>Task Progress</Text>
                <Text style={styles.progressPercent}>{stats.percentage}%</Text>
              </View>

              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${stats.percentage}%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.progressStats}>
                <View style={styles.progressStat}>
                  <Text style={styles.progressStatValue}>{stats.completed}</Text>
                  <Text style={styles.progressStatLabel}>Completed</Text>
                </View>
                <View style={styles.progressStatDivider} />
                <View style={styles.progressStat}>
                  <Text style={styles.progressStatValue}>{stats.total}</Text>
                  <Text style={styles.progressStatLabel}>Total</Text>
                </View>
              </View>
            </View>

            {/* Tasks Section */}
            <View style={styles.tasksSection}>
              <View style={styles.tasksSectionHeader}>
                <Text style={styles.sectionTitle}>Tasks</Text>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('CreateTask', {
                      projectId,
                    })
                  }
                >
                  <Text style={styles.createTaskLink}>+ Add Task</Text>
                </TouchableOpacity>
              </View>

              {tasks.length > 0 ? (
                <>
                  {/* Task Status Summary */}
                  <View style={styles.taskStatusGrid}>
                    {[
                      { status: 'todo', label: 'To Do', color: '#999' },
                      {
                        status: 'in-progress',
                        label: 'In Progress',
                        color: '#4ecdc4',
                      },
                      { status: 'review', label: 'Review', color: '#667eea' },
                      { status: 'done', label: 'Done', color: '#6bcf7f' },
                    ].map(({ status, label, color }) => (
                      <View key={status} style={styles.statusCard}>
                        <Text style={styles.statusCardCount}>
                          {getTasksByStatus(status).length}
                        </Text>
                        <Text
                          style={[styles.statusCardLabel, { color }]}
                        >
                          {label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Tasks List */}
                  <View style={styles.tasksList}>
                    {tasks.map((task) => (
                      <TouchableOpacity
                        key={task._id}
                        style={styles.taskCard}
                        onPress={() =>
                          navigation.navigate('TaskDetail', {
                            taskId: task._id,
                          })
                        }
                      >
                        <View
                          style={[
                            styles.taskPriorityIndicator,
                            {
                              backgroundColor: getPriorityColor(task.priority),
                            },
                          ]}
                        />

                        <View style={styles.taskInfo}>
                          <Text style={styles.taskTitle} numberOfLines={1}>
                            {task.title}
                          </Text>
                          <View style={styles.taskMeta}>
                            <View
                              style={[
                                styles.taskStatusBadge,
                                {
                                  backgroundColor:
                                    getStatusColor(task.status) + '20',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.taskStatusBadgeText,
                                  { color: getStatusColor(task.status) },
                                ]}
                              >
                                {task.status.replace('-', ' ')}
                              </Text>
                            </View>
                            {task.dueDate && (
                              <Text style={styles.taskDueDate}>
                                {new Date(task.dueDate).toLocaleDateString(
                                  'en-US',
                                  { month: 'short', day: 'numeric' }
                                )}
                              </Text>
                            )}
                          </View>
                        </View>

                        <Text style={styles.taskArrow}>›</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <View style={styles.emptyTasks}>
                  <Text style={styles.emptyTasksIcon}>📝</Text>
                  <Text style={styles.emptyTasksTitle}>No tasks yet</Text>
                  <Text style={styles.emptyTasksDescription}>
                    Create your first task for this project
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyTasksButton}
                    onPress={() =>
                      navigation.navigate('CreateTask', {
                        projectId,
                      })
                    }
                  >
                    <Text style={styles.emptyTasksButtonText}>Create Task</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickActionButton}>
                <Text style={styles.quickActionIcon}>⚙️</Text>
                <Text style={styles.quickActionLabel}>Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickActionButton}>
                <Text style={styles.quickActionIcon}>👥</Text>
                <Text style={styles.quickActionLabel}>Members</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickActionButton}>
                <Text style={styles.quickActionIcon}>📊</Text>
                <Text style={styles.quickActionLabel}>Analytics</Text>
              </TouchableOpacity>
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
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  backButton: {
    fontSize: 32,
    color: '#1a1a1a',
    fontWeight: '300',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  headerSpacer: {
    width: 32,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  descriptionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressPercent: {
    fontSize: 24,
    fontWeight: '700',
    color: '#667eea',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  progressStat: {
    flex: 1,
    alignItems: 'center',
  },
  progressStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#f0f0f0',
  },
  progressStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  progressStatLabel: {
    fontSize: 12,
    color: '#999',
  },
  tasksSection: {
    marginBottom: 20,
  },
  tasksSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  createTaskLink: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  taskStatusGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statusCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statusCardCount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statusCardLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tasksList: {
    gap: 10,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  taskPriorityIndicator: {
    width: 4,
    height: 50,
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
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  taskStatusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  taskDueDate: {
    fontSize: 11,
    color: '#999',
  },
  taskArrow: {
    fontSize: 24,
    color: '#667eea',
    marginLeft: 12,
    fontWeight: '300',
  },
  emptyTasks: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTasksIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTasksTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  emptyTasksDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  emptyTasksButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyTasksButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
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
    fontSize: 11,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffe0e0',
    borderRadius: 12,
    padding: 16,
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
