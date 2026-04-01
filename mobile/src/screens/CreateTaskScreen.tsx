import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { getApiClient } from '../lib/api-client';
import { MainStackNavigationProp, MainStackRouteProp } from '../types/navigation';

interface CreateTaskScreenProps {
  navigation: MainStackNavigationProp;
  route: MainStackRouteProp<'CreateTask'>;
}

export const CreateTaskScreen: React.FC<CreateTaskScreenProps> = ({
  navigation,
  route,
}) => {
  const { projectId } = route.params;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [status, setStatus] = useState<'todo' | 'in-progress' | 'review' | 'done'>(
    'todo'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const apiClient = getApiClient();

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Task title is required';
    }

    if (!projectId) {
      newErrors.project = 'Please select a project';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateTask = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await apiClient.createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        projectId: projectId || '',
      });

      Alert.alert('Success', 'Task created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create task');
    } finally {
      setIsLoading(false);
    }
  };

  const PriorityButton = ({ value }: { value: 'low' | 'medium' | 'high' }) => (
    <TouchableOpacity
      style={[
        styles.priorityButton,
        priority === value && styles.priorityButtonActive,
        {
          borderColor:
            priority === value
              ? getPriorityColor(value)
              : '#ddd',
          backgroundColor:
            priority === value
              ? getPriorityColor(value) + '15'
              : '#fff',
        },
      ]}
      onPress={() => setPriority(value)}
    >
      <Text
        style={[
          styles.priorityButtonText,
          {
            color:
              priority === value
                ? getPriorityColor(value)
                : '#666',
          },
        ]}
      >
        {value.charAt(0).toUpperCase() + value.slice(1)}
      </Text>
    </TouchableOpacity>
  );

  const StatusButton = ({ value }: { value: 'todo' | 'in-progress' | 'review' | 'done' }) => (
    <TouchableOpacity
      style={[
        styles.statusButton,
        status === value && styles.statusButtonActive,
        {
          borderColor:
            status === value
              ? getStatusColor(value)
              : '#ddd',
          backgroundColor:
            status === value
              ? getStatusColor(value) + '15'
              : '#fff',
        },
      ]}
      onPress={() => setStatus(value)}
    >
      <Text
        style={[
          styles.statusButtonText,
          {
            color:
              status === value
                ? getStatusColor(value)
                : '#666',
          },
        ]}
      >
        {value.replace('-', ' ')}
      </Text>
    </TouchableOpacity>
  );

  const getPriorityColor = (p: string): string => {
    switch (p) {
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

  const getStatusColor = (s: string): string => {
    switch (s) {
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backButton}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Create Task</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Form Content */}
          <View style={styles.content}>
            {/* Title Field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Task Title *</Text>
              <TextInput
                style={[styles.input, errors.title && styles.inputError]}
                placeholder="Enter task title"
                placeholderTextColor="#999"
                value={title}
                onChangeText={(text) => {
                  setTitle(text);
                  if (errors.title) setErrors({ ...errors, title: undefined });
                }}
                editable={!isLoading}
              />
              {errors.title && (
                <Text style={styles.errorText}>{errors.title}</Text>
              )}
            </View>

            {/* Description Field */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.textarea, styles.input]}
                placeholder="Enter task description (optional)"
                placeholderTextColor="#999"
                value={description}
                onChangeText={setDescription}
                editable={!isLoading}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Priority Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Priority</Text>
              <View style={styles.buttonGroup}>
                <PriorityButton value="low" />
                <PriorityButton value="medium" />
                <PriorityButton value="high" />
              </View>
            </View>

            {/* Status Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.statusGrid}>
                <StatusButton value="todo" />
                <StatusButton value="in-progress" />
                <StatusButton value="review" />
                <StatusButton value="done" />
              </View>
            </View>

            {/* Project Info */}
            {projectId && (
              <View style={styles.projectInfo}>
                <Text style={styles.projectInfoLabel}>Project ID</Text>
                <Text style={styles.projectInfoValue}>{projectId}</Text>
              </View>
            )}

            {/* Create Button */}
            <TouchableOpacity
              style={[styles.createButton, isLoading && styles.createButtonDisabled]}
              onPress={handleCreateTask}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.createButtonText}>Create Task</Text>
              )}
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => navigation.goBack()}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#eee',
  },
  inputError: {
    borderColor: '#ff6b6b',
    backgroundColor: 'rgba(255, 107, 107, 0.05)',
  },
  textarea: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
  },
  priorityButtonActive: {
    fontWeight: '700',
  },
  priorityButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusButton: {
    flex: 1,
    minWidth: '48%',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
  },
  statusButtonActive: {
    fontWeight: '700',
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  projectInfo: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  projectInfoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  projectInfoValue: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '600',
    fontFamily: 'Menlo',
  },
  createButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#eee',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '700',
  },
});
