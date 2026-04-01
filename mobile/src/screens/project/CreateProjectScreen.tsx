import React, { useState, useMemo } from 'react';
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
  FlatList,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { getApiClient } from '../../lib/api-client';
import { MainStackNavigationProp } from '../../types/navigation';

interface CreateProjectScreenProps {
  navigation: MainStackNavigationProp;
}

interface TeamMember {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
}

interface SelectedMember {
  userId: string;
  name: string;
  email: string;
  permission: 'admin' | 'editor' | 'viewer';
}

type TemplateType = 'blank' | 'agile' | 'kanban' | 'waterfall';

// Mock team members - in production, fetch from API
const MOCK_TEAM_MEMBERS: TeamMember[] = [
  { userId: '1', name: 'John Doe', email: 'john@example.com' },
  { userId: '2', name: 'Jane Smith', email: 'jane@example.com' },
  { userId: '3', name: 'Mike Johnson', email: 'mike@example.com' },
  { userId: '4', name: 'Sarah Williams', email: 'sarah@example.com' },
  { userId: '5', name: 'David Brown', email: 'david@example.com' },
];

const TEMPLATES = [
  { id: 'blank', label: 'Blank Project', icon: '📄' },
  { id: 'agile', label: 'Agile/Scrum', icon: '🚀' },
  { id: 'kanban', label: 'Kanban Board', icon: '📊' },
  { id: 'waterfall', label: 'Waterfall', icon: '🌊' },
];

const PERMISSIONS = [
  { value: 'admin', label: 'Admin', color: '#ff6b6b' },
  { value: 'editor', label: 'Editor', color: '#667eea' },
  { value: 'viewer', label: 'Viewer', color: '#999' },
];

export const CreateProjectScreen: React.FC<CreateProjectScreenProps> = ({
  navigation,
}) => {
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [templateType, setTemplateType] = useState<TemplateType>('blank');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingPermission, setEditingPermission] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const apiClient = getApiClient();

  const filteredMembers = useMemo(() => {
    const selectedIds = selectedMembers.map((m) => m.userId);
    return MOCK_TEAM_MEMBERS.filter((member) => {
      const matchesSearch = member.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const notSelected = !selectedIds.includes(member.userId);
      return matchesSearch && notSelected;
    });
  }, [searchQuery, selectedMembers]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!projectName.trim()) {
      newErrors.projectName = 'Project name is required';
    } else if (projectName.length < 3) {
      newErrors.projectName = 'Project name must be at least 3 characters';
    } else if (projectName.length > 100) {
      newErrors.projectName = 'Project name must be less than 100 characters';
    }

    if (description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddMember = (member: TeamMember) => {
    const newMember: SelectedMember = {
      ...member,
      permission: 'editor',
    };
    setSelectedMembers([...selectedMembers, newMember]);
    setSearchQuery('');
  };

  const handleRemoveMember = (userId: string) => {
    setSelectedMembers(selectedMembers.filter((m) => m.userId !== userId));
  };

  const handleUpdatePermission = (userId: string, permission: 'admin' | 'editor' | 'viewer') => {
    setSelectedMembers(
      selectedMembers.map((m) =>
        m.userId === userId ? { ...m, permission } : m
      )
    );
  };

  const handleCreateProject = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const newProject = {
        name: projectName.trim(),
        description: description.trim() || undefined,
        members: selectedMembers.map((m) => ({
          userId: m.userId,
          permission: m.permission,
        })),
        template: templateType,
      };

      // In production, would call: await apiClient.createProject(newProject);

      Alert.alert('Success', 'Project created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create project');
    } finally {
      setIsLoading(false);
    }
  };

  const getPermissionColor = (permission: string): string => {
    const perm = PERMISSIONS.find((p) => p.value === permission);
    return perm?.color || '#999';
  };

  const getMemberInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
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
            <Text style={styles.title}>Create Project</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.content}>
            {/* Project Name */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Project Details</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Project Name *</Text>
                <TextInput
                  style={[styles.input, errors.projectName && styles.inputError]}
                  placeholder="Enter project name"
                  placeholderTextColor="#999"
                  value={projectName}
                  onChangeText={(text) => {
                    setProjectName(text);
                    if (errors.projectName) setErrors({ ...errors, projectName: undefined });
                  }}
                  editable={!isLoading}
                  maxLength={100}
                />
                <View style={styles.helpText}>
                  <Text style={styles.charCount}>{projectName.length}/100</Text>
                </View>
                {errors.projectName && (
                  <Text style={styles.errorText}>{errors.projectName}</Text>
                )}
              </View>

              {/* Description */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.textarea, errors.description && styles.inputError]}
                  placeholder="Enter project description (optional)"
                  placeholderTextColor="#999"
                  value={description}
                  onChangeText={(text) => {
                    setDescription(text);
                    if (errors.description) setErrors({ ...errors, description: undefined });
                  }}
                  editable={!isLoading}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                />
                <View style={styles.helpText}>
                  <Text style={styles.charCount}>{description.length}/500</Text>
                </View>
                {errors.description && (
                  <Text style={styles.errorText}>{errors.description}</Text>
                )}
              </View>
            </View>

            {/* Template Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Project Template</Text>

              <View style={styles.templateGrid}>
                {TEMPLATES.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={[
                      styles.templateCard,
                      templateType === template.id && styles.templateCardActive,
                    ]}
                    onPress={() => setTemplateType(template.id as TemplateType)}
                    disabled={isLoading}
                  >
                    <Text style={styles.templateIcon}>{template.icon}</Text>
                    <Text
                      style={[
                        styles.templateLabel,
                        templateType === template.id && styles.templateLabelActive,
                      ]}
                    >
                      {template.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Team Members */}
            <View style={styles.section}>
              <View style={styles.membersSectionHeader}>
                <Text style={styles.sectionTitle}>Team Members</Text>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => setShowMemberPicker(true)}
                  disabled={isLoading}
                >
                  <Text style={styles.addButtonText}>+ Add</Text>
                </TouchableOpacity>
              </View>

              {selectedMembers.length > 0 ? (
                <View style={styles.selectedMembersList}>
                  {selectedMembers.map((member) => (
                    <View key={member.userId} style={styles.memberCard}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>
                          {getMemberInitials(member.name)}
                        </Text>
                      </View>

                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{member.name}</Text>
                        <Text style={styles.memberEmail}>{member.email}</Text>
                      </View>

                      <View style={styles.memberPermission}>
                        <TouchableOpacity
                          style={[
                            styles.permissionBadge,
                            {
                              backgroundColor: getPermissionColor(member.permission) + '20',
                            },
                          ]}
                          onPress={() => {
                            setEditingMemberId(member.userId);
                            setEditingPermission(member.permission);
                          }}
                          disabled={isLoading}
                        >
                          <Text
                            style={[
                              styles.permissionText,
                              { color: getPermissionColor(member.permission) },
                            ]}
                          >
                            {member.permission}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveMember(member.userId)}
                        disabled={isLoading}
                      >
                        <Text style={styles.removeButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No team members added yet</Text>
                  <Text style={styles.emptyStateHint}>Tap + Add to invite team members</Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.createButton, isLoading && styles.buttonDisabled]}
                onPress={handleCreateProject}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.createButtonText}>Create Project</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => navigation.goBack()}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Member Picker Modal */}
        <Modal
          visible={showMemberPicker}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowMemberPicker(false)}
        >
          <LinearGradient colors={['#f5f7fa', '#f5f7fa']} style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowMemberPicker(false)}>
                <Text style={styles.modalCloseButton}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Team Members</Text>
              <View style={styles.modalHeaderSpacer} />
            </View>

            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search members..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <FlatList
              data={filteredMembers}
              keyExtractor={(item) => item.userId}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.memberListItem}
                  onPress={() => {
                    handleAddMember(item);
                    setShowMemberPicker(false);
                  }}
                >
                  <View style={styles.memberListAvatar}>
                    <Text style={styles.memberListAvatarText}>
                      {getMemberInitials(item.name)}
                    </Text>
                  </View>

                  <View style={styles.memberListInfo}>
                    <Text style={styles.memberListName}>{item.name}</Text>
                    <Text style={styles.memberListEmail}>{item.email}</Text>
                  </View>

                  <Text style={styles.addIcon}>+</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.memberListContent}
              ListEmptyComponent={
                <View style={styles.noResults}>
                  <Text style={styles.noResultsText}>No members found</Text>
                </View>
              }
            />
          </LinearGradient>
        </Modal>

        {/* Permission Modal */}
        <Modal
          visible={editingMemberId !== null}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setEditingMemberId(null)}
        >
          <View style={styles.permissionModalOverlay}>
            <View style={styles.permissionModalContent}>
              <Text style={styles.permissionModalTitle}>Set Permission</Text>

              {PERMISSIONS.map((perm) => (
                <TouchableOpacity
                  key={perm.value}
                  style={[
                    styles.permissionOption,
                    editingPermission === perm.value &&
                      styles.permissionOptionSelected,
                  ]}
                  onPress={() => {
                    if (editingMemberId) {
                      handleUpdatePermission(
                        editingMemberId,
                        perm.value as 'admin' | 'editor' | 'viewer'
                      );
                    }
                    setEditingMemberId(null);
                  }}
                >
                  <View
                    style={[
                      styles.permissionOptionRadio,
                      {
                        backgroundColor:
                          editingPermission === perm.value
                            ? perm.color
                            : '#fff',
                        borderColor: perm.color,
                      },
                    ]}
                  >
                    {editingPermission === perm.value && (
                      <Text style={styles.permissionOptionRadioCheck}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.permissionOptionText}>{perm.label}</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.permissionModalClose}
                onPress={() => setEditingMemberId(null)}
              >
                <Text style={styles.permissionModalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  membersSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 16,
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
  textarea: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#eee',
    height: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#ff6b6b',
    backgroundColor: 'rgba(255, 107, 107, 0.05)',
  },
  helpText: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  charCount: {
    fontSize: 11,
    color: '#999',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  templateGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  templateCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#eee',
  },
  templateCardActive: {
    borderColor: '#667eea',
    backgroundColor: '#667eea' + '10',
  },
  templateIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  templateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  templateLabelActive: {
    color: '#667eea',
  },
  selectedMembersList: {
    gap: 10,
  },
  memberCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 11,
    color: '#999',
  },
  memberPermission: {
    marginRight: 8,
  },
  permissionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  permissionText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  removeButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#ff6b6b',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  emptyStateHint: {
    fontSize: 12,
    color: '#999',
  },
  actions: {
    gap: 12,
  },
  createButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
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
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  modalCloseButton: {
    fontSize: 32,
    color: '#1a1a1a',
    fontWeight: '300',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  modalHeaderSpacer: {
    width: 32,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
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
  memberListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  memberListItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  memberListAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberListAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  memberListInfo: {
    flex: 1,
  },
  memberListName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  memberListEmail: {
    fontSize: 12,
    color: '#999',
  },
  addIcon: {
    fontSize: 20,
    color: '#667eea',
    fontWeight: '700',
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 14,
    color: '#999',
  },
  // Permission Modal
  permissionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  permissionModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  permissionModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  permissionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  permissionOptionSelected: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  permissionOptionRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionOptionRadioCheck: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  permissionOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  permissionModalClose: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  permissionModalCloseText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
