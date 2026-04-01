import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { getApiClient } from '../lib/api-client';
import { MainStackNavigationProp } from '../types/navigation';

interface TasksScreenProps {
  navigation: MainStackNavigationProp;
}

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  projectId: string;
  createdAt: string;
}

type TaskStatus = 'all' | 'todo' | 'in-progress' | 'review' | 'done';
type TaskPriority = 'all' | 'low' | 'medium' | 'high';

export const TasksScreen: React.FC<TasksScreenProps> = ({ navigation }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority>('all');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const apiClient = getApiClient();

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    filterTasks();
  }, [tasks, searchQuery, filterStatus, filterPriority]);

  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.getTasks({ limit: 100 });
      setTasks(result || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTasks();
    setIsRefreshing(false);
  };

  const filterTasks = () => {
    let filtered = tasks;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter((t) => t.status === filterStatus);
    }

    // Filter by priority
    if (filterPriority !== 'all') {
      filtered = filtered.filter((t) => t.priority === filterPriority);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((t) => t.title.toLowerCase().includes(query));
    }

    setFilteredTasks(filtered);
  };

  const handleTaskPress = (taskId: string) => {
    navigation.navigate('TaskDetail', { taskId });
  };

  const handleCreateTask = () => {
    navigation.navigate('CreateTask', { projectId: undefined });
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

  const getDaysUntilDue = (dueDate: string | undefined): number | null => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getTasksByStatus = (status: TaskStatus): Task[] => {
    if (status === 'all') return filteredTasks;
    return filteredTasks.filter((t) => t.status === status);
  };

  const statusOptions: TaskStatus[] = ['todo', 'in-progress', 'review', 'done'];

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
          <Text style={styles.title}>Tasks</Text>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateTask}>
            <Text style={styles.createButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search tasks..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Controls */}
        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Status:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterTabs}
            >
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  filterStatus === 'all' && styles.filterTabActive,
                ]}
                onPress={() => setFilterStatus('all')}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filterStatus === 'all' && styles.filterTabTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  filterStatus === 'todo' && styles.filterTabActive,
                ]}
                onPress={() => setFilterStatus('todo')}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filterStatus === 'todo' && styles.filterTabTextActive,
                  ]}
                >
                  To Do
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  filterStatus === 'in-progress' && styles.filterTabActive,
                ]}
                onPress={() => setFilterStatus('in-progress')}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filterStatus === 'in-progress' && styles.filterTabTextActive,
                  ]}
                >
                  In Progress
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  filterStatus === 'review' && styles.filterTabActive,
                ]}
                onPress={() => setFilterStatus('review')}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filterStatus === 'review' && styles.filterTabTextActive,
                  ]}
                >
                  Review
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  filterStatus === 'done' && styles.filterTabActive,
                ]}
                onPress={() => setFilterStatus('done')}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filterStatus === 'done' && styles.filterTabTextActive,
                  ]}
                >
                  Done
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Priority:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterTabs}
            >
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  filterPriority === 'all' && styles.filterTabActive,
                ]}
                onPress={() => setFilterPriority('all')}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filterPriority === 'all' && styles.filterTabTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  filterPriority === 'low' && styles.filterTabActive,
                ]}
                onPress={() => setFilterPriority('low')}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filterPriority === 'low' && styles.filterTabTextActive,
                  ]}
                >
                  Low
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  filterPriority === 'medium' && styles.filterTabActive,
                ]}
                onPress={() => setFilterPriority('medium')}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filterPriority === 'medium' && styles.filterTabTextActive,
                  ]}
                >
                  Medium
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  filterPriority === 'high' && styles.filterTabActive,
                ]}
                onPress={() => setFilterPriority('high')}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filterPriority === 'high' && styles.filterTabTextActive,
                  ]}
                >
                  High
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadTasks}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading tasks...</Text>
          </View>
        )}

        {/* Tasks List View */}
        {!isLoading && viewMode === 'list' && filteredTasks.length > 0 && (
          <View style={styles.tasksList}>
            {filteredTasks.map((task) => {
              const daysUntilDue = getDaysUntilDue(task.dueDate);
              const isOverdue =
                daysUntilDue !== null && daysUntilDue < 0 && task.status !== 'done';

              return (
                <TouchableOpacity
                  key={task._id}
                  style={styles.taskCard}
                  onPress={() => handleTaskPress(task._id)}
                >
                  <View
                    style={[
                      styles.priorityIndicator,
                      { backgroundColor: getPriorityColor(task.priority) },
                    ]}
                  />

                  <View style={styles.taskCardContent}>
                    <View style={styles.taskHeader}>
                      <Text style={styles.taskTitle} numberOfLines={2}>
                        {task.title}
                      </Text>
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
                          {task.status.replace('-', ' ')}
                        </Text>
                      </View>
                    </View>

                    {task.description && (
                      <Text style={styles.taskDescription} numberOfLines={1}>
                        {task.description}
                      </Text>
                    )}

                    <View style={styles.taskFooter}>
                      <View style={styles.priorityLabel}>
                        <Text style={styles.priorityBadge}>{task.priority}</Text>
                      </View>

                      {task.dueDate && (
                        <Text
                          style={[
                            styles.dueDate,
                            isOverdue && styles.overdueDueDate,
                          ]}
                        >
                          {daysUntilDue !== null && daysUntilDue >= 0
                            ? `Due in ${daysUntilDue}d`
                            : `${Math.abs(daysUntilDue || 0)}d overdue`}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.taskArrow}>
                    <Text style={styles.arrowIcon}>›</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredTasks.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>✅</Text>
            <Text style={styles.emptyStateTitle}>
              {searchQuery ? 'No tasks found' : 'No tasks yet'}
            </Text>
            <Text style={styles.emptyStateDescription}>
              {searchQuery
                ? 'Try adjusting your filters'
                : 'Create your first task to get started'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity style={styles.emptyStateButton} onPress={handleCreateTask}>
                <Text style={styles.emptyStateButtonText}>Create Task</Text>
              </TouchableOpacity>
            )}
          </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  createButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1a1a1a',
  },
  clearIcon: {
    fontSize: 16,
    color: '#999',
  },
  filterSection: {
    marginBottom: 16,
    gap: 12,
  },
  filterRow: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 2,
  },
  filterTabs: {
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  filterTabActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  tasksList: {
    gap: 12,
    marginBottom: 20,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  priorityIndicator: {
    width: 4,
    height: '100%',
    borderRadius: 12,
  },
  taskCardContent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 50,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  taskDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityLabel: {
    flex: 1,
  },
  priorityBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#667eea',
    textTransform: 'capitalize',
  },
  dueDate: {
    fontSize: 11,
    color: '#999',
  },
  overdueDueDate: {
    color: '#ff6b6b',
    fontWeight: '600',
  },
  taskArrow: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 12,
  },
  arrowIcon: {
    fontSize: 24,
    color: '#667eea',
    fontWeight: '300',
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyStateButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
