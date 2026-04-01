import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { getApiClient } from '../lib/api-client';
import { MainStackNavigationProp, MainStackRouteProp } from '../types/navigation';

interface TaskDetailScreenProps {
  navigation: MainStackNavigationProp;
  route: MainStackRouteProp<'TaskDetail'>;
}

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  projectId: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export const TaskDetailScreen: React.FC<TaskDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { taskId } = route.params;
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const apiClient = getApiClient();

  useEffect(() => {
    loadTaskDetails();
  }, [taskId]);

  const loadTaskDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.getTask(taskId);
      setTask(result || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load task');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTaskDetails();
    setIsRefreshing(false);
  };

  const updateTaskStatus = async (newStatus: string) => {
    if (!task) return;

    setIsUpdatingStatus(true);
    try {
      await apiClient.updateTaskStatus(task._id, newStatus);
      setTask({ ...task, status: newStatus as any });
      Alert.alert('Success', `Task status updated to ${newStatus}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update task status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const showStatusOptions = () => {
    const statuses = ['todo', 'in-progress', 'review', 'done'];
    const options = statuses.map((status) => ({
      text: status.replace('-', ' ').toUpperCase(),
      onPress: () => updateTaskStatus(status),
    }));

    Alert.alert('Change Status', 'Select a new status:', [
      ...options,
      { text: 'Cancel', style: 'cancel' },
    ]);
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

  const getDaysUntilDue = (): number | null => {
    if (!task?.dueDate) return null;
    const due = new Date(task.dueDate);
    const now = new Date();
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const isOverdue = (): boolean => {
    const days = getDaysUntilDue();
    return days !== null && days < 0 && task?.status !== 'done';
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
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={2}>
            {task?.title || 'Task'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadTaskDetails}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading task...</Text>
          </View>
        )}

        {/* Task Details */}
        {!isLoading && task && (
          <>
            {/* Status and Priority Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Status</Text>
                  <TouchableOpacity
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: getStatusColor(task.status) + '20',
                      },
                    ]}
                    onPress={showStatusOptions}
                    disabled={isUpdatingStatus}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: getStatusColor(task.status) },
                      ]}
                    >
                      {task.status.replace('-', ' ')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.statusDivider} />

                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Priority</Text>
                  <View
                    style={[
                      styles.priorityBadge,
                      {
                        backgroundColor: getPriorityColor(task.priority) + '20',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityBadgeText,
                        { color: getPriorityColor(task.priority) },
                      ]}
                    >
                      {task.priority}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Description Card */}
            {task.description && (
              <View style={styles.descriptionCard}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.descriptionText}>{task.description}</Text>
              </View>
            )}

            {/* Details Card */}
            <View style={styles.detailsCard}>
              <Text style={styles.sectionTitle}>Details</Text>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Project</Text>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('ProjectDetail', {
                      projectId: task.projectId,
                    })
                  }
                >
                  <Text style={styles.detailLinkValue}>View Project ›</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {task.assignedTo && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Assigned To</Text>
                    <Text style={styles.detailValue}>{task.assignedTo}</Text>
                  </View>
                  <View style={styles.divider} />
                </>
              )}

              {task.dueDate && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Due Date</Text>
                    <View style={styles.dueDateValue}>
                      <Text
                        style={[
                          styles.detailValue,
                          isOverdue() && styles.overdueValue,
                        ]}
                      >
                        {new Date(task.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                      {getDaysUntilDue() !== null && (
                        <Text
                          style={[
                            styles.daysText,
                            isOverdue() && styles.overdaysDaysText,
                          ]}
                        >
                          ({isOverdue() ? `${Math.abs(getDaysUntilDue()!)}d overdue` : `${getDaysUntilDue()}d left`})
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.divider} />
                </>
              )}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Created</Text>
                <Text style={styles.detailValue}>
                  {new Date(task.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Last Updated</Text>
                <Text style={styles.detailValue}>
                  {new Date(task.updatedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActionsSection}>
              {task.status !== 'done' && (
                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() => updateTaskStatus('done')}
                  disabled={isUpdatingStatus}
                >
                  <Text style={styles.quickActionIcon}>✓</Text>
                  <Text style={styles.quickActionLabel}>Mark Complete</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.quickActionButton,
                  styles.quickActionButtonSecondary,
                ]}
              >
                <Text style={styles.quickActionIconSecondary}>💬</Text>
                <Text style={styles.quickActionLabelSecondary}>Comments</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickActionButton,
                  styles.quickActionButtonSecondary,
                ]}
              >
                <Text style={styles.quickActionIconSecondary}>📎</Text>
                <Text style={styles.quickActionLabelSecondary}>Attachments</Text>
              </TouchableOpacity>
            </View>

            {/* Edit Button */}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() =>
                navigation.navigate('CreateTask', { projectId: task.projectId })
              }
            >
              <Text style={styles.editButtonIcon}>✏️</Text>
              <Text style={styles.editButtonText}>Edit Task</Text>
            </TouchableOpacity>
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
  statusCard: {
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
  },
  statusDivider: {
    width: 1,
    height: 60,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 12,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  priorityBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
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
  detailsCard: {
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
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  detailLinkValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  dueDateValue: {
    alignItems: 'flex-end',
  },
  daysText: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  overdaysDaysText: {
    color: '#ff6b6b',
    fontWeight: '600',
  },
  overdueValue: {
    color: '#ff6b6b',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  quickActionsSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#667eea',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionButtonSecondary: {
    backgroundColor: '#fff',
  },
  quickActionIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  quickActionIconSecondary: {
    fontSize: 20,
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  quickActionLabelSecondary: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  editButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#667eea',
    marginBottom: 20,
  },
  editButtonIcon: {
    fontSize: 16,
  },
  editButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '700',
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
