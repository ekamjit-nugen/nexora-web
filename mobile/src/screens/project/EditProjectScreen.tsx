import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  permission?: 'admin' | 'editor' | 'viewer';
}

interface ProjectData {
  id: string;
  name: string;
  description: string;
  template: 'blank' | 'agile' | 'kanban' | 'waterfall';
  members: TeamMember[];
  createdAt: string;
}

interface EditProjectScreenProps {
  navigation: any;
  route?: any;
}

const MOCK_TEAM_MEMBERS: TeamMember[] = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com' },
  { id: '3', name: 'Carol Davis', email: 'carol@example.com' },
  { id: '4', name: 'David Lee', email: 'david@example.com' },
  { id: '5', name: 'Eve Wilson', email: 'eve@example.com' },
];

const TEMPLATES = [
  { id: 'blank', label: 'Blank Project', icon: '📄' },
  { id: 'agile', label: 'Agile/Scrum', icon: '🚀' },
  { id: 'kanban', label: 'Kanban Board', icon: '📊' },
  { id: 'waterfall', label: 'Waterfall', icon: '🌊' },
];

const PERMISSION_COLORS: { [key: string]: string } = {
  admin: '#ff6b6b',
  editor: '#667eea',
  viewer: '#999',
};

export const EditProjectScreen: React.FC<EditProjectScreenProps> = ({ navigation, route }) => {
  const projectId = route?.params?.projectId || '1';
  const [projectName, setProjectName] = useState('My Awesome Project');
  const [description, setDescription] = useState('This is a test project for our team');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank');
  const [selectedMembers, setSelectedMembers] = useState<TeamMember[]>([
    { id: '1', name: 'Alice Johnson', email: 'alice@example.com', permission: 'admin' },
    { id: '2', name: 'Bob Smith', email: 'bob@example.com', permission: 'editor' },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedMemberForPermission, setSelectedMemberForPermission] = useState<TeamMember | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    // Load project data from API in real app
    // For now, using mock data
  }, [projectId]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!projectName.trim()) {
      newErrors.name = 'Project name is required';
    } else if (projectName.length < 3) {
      newErrors.name = 'Project name must be at least 3 characters';
    } else if (projectName.length > 100) {
      newErrors.name = 'Project name must be less than 100 characters';
    }

    if (description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNameChange = (text: string) => {
    setProjectName(text);
    if (errors.name) {
      setErrors({ ...errors, name: '' });
    }
  };

  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    if (errors.description) {
      setErrors({ ...errors, description: '' });
    }
  };

  const handleAddMember = (member: TeamMember) => {
    const alreadyAdded = selectedMembers.some((m) => m.id === member.id);
    if (!alreadyAdded) {
      setSelectedMembers([
        ...selectedMembers,
        { ...member, permission: 'editor' },
      ]);
    }
    setShowMemberModal(false);
  };

  const handleRemoveMember = (memberId: string) => {
    setSelectedMembers(selectedMembers.filter((m) => m.id !== memberId));
  };

  const handlePermissionChange = (permission: 'admin' | 'editor' | 'viewer') => {
    if (selectedMemberForPermission) {
      setSelectedMembers(
        selectedMembers.map((m) =>
          m.id === selectedMemberForPermission.id
            ? { ...m, permission }
            : m
        )
      );
    }
    setShowPermissionModal(false);
    setSelectedMemberForPermission(null);
  };

  const handleSaveChanges = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert('Success', 'Project updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to update project');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = () => {
    setShowDeleteConfirm(false);
    Alert.alert('Delete Project', 'Are you sure you want to delete this project? This action cannot be undone.', [
      {
        text: 'Cancel',
        onPress: () => {},
        style: 'cancel',
      },
      {
        text: 'Delete',
        onPress: async () => {
          setIsLoading(true);
          try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1000));
            Alert.alert('Deleted', 'Project deleted successfully', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete project');
          } finally {
            setIsLoading(false);
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const getAvailableMembers = () => {
    const selectedIds = selectedMembers.map((m) => m.id);
    return MOCK_TEAM_MEMBERS.filter((m) => !selectedIds.includes(m.id));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <LinearGradient colors={['#f5f7fa', '#e9ecef']} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#fff' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={{ fontSize: 24 }}>‹</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#000' }}>Edit Project</Text>
              <View style={{ width: 24 }} />
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {/* Project Details Section */}
            <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#000' }}>Project Details</Text>
              <View
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 6, color: '#666' }}>Project Name *</Text>
                <TextInput
                  placeholder="Enter project name"
                  value={projectName}
                  onChangeText={handleNameChange}
                  maxLength={100}
                  style={{
                    borderWidth: 1,
                    borderColor: errors.name ? '#ff6b6b' : '#e0e0e0',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    marginBottom: 8,
                    fontSize: 14,
                    color: '#000',
                  }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  {errors.name && <Text style={{ color: '#ff6b6b', fontSize: 12 }}>{errors.name}</Text>}
                  <Text style={{ marginLeft: 'auto', fontSize: 12, color: '#999' }}>{projectName.length}/100</Text>
                </View>

                <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 6, color: '#666' }}>Description</Text>
                <TextInput
                  placeholder="Enter project description (optional)"
                  value={description}
                  onChangeText={handleDescriptionChange}
                  maxLength={500}
                  multiline
                  numberOfLines={4}
                  style={{
                    borderWidth: 1,
                    borderColor: errors.description ? '#ff6b6b' : '#e0e0e0',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    marginBottom: 8,
                    fontSize: 14,
                    textAlignVertical: 'top',
                    color: '#000',
                  }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {errors.description && (
                    <Text style={{ color: '#ff6b6b', fontSize: 12 }}>{errors.description}</Text>
                  )}
                  <Text style={{ marginLeft: 'auto', fontSize: 12, color: '#999' }}>
                    {description.length}/500
                  </Text>
                </View>
              </View>
            </View>

            {/* Template Selection Section */}
            <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#000' }}>Project Template</Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                }}
              >
                {TEMPLATES.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    onPress={() => setSelectedTemplate(template.id)}
                    style={{
                      width: '48%',
                      paddingVertical: 16,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: selectedTemplate === template.id ? '#667eea' : '#fff',
                      marginBottom: 12,
                      borderWidth: selectedTemplate === template.id ? 0 : 1,
                      borderColor: '#e0e0e0',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 28, marginBottom: 8 }}>{template.icon}</Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: selectedTemplate === template.id ? '#fff' : '#000',
                        textAlign: 'center',
                      }}
                    >
                      {template.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Team Members Section */}
            <View style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 40 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#000' }}>Team Members</Text>
                <TouchableOpacity
                  onPress={() => setShowMemberModal(true)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    backgroundColor: '#667eea',
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>+ Add</Text>
                </TouchableOpacity>
              </View>

              {selectedMembers.length === 0 ? (
                <View
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    padding: 24,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 14, color: '#999' }}>No team members added yet</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }}>
                  {selectedMembers.map((member, index) => (
                    <View
                      key={member.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 12,
                        borderBottomWidth: index < selectedMembers.length - 1 ? 1 : 0,
                        borderBottomColor: '#f0f0f0',
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: '#667eea',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                          {getInitials(member.name)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', fontSize: 14, color: '#000' }}>{member.name}</Text>
                        <Text style={{ fontSize: 12, color: '#999' }}>{member.email}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedMemberForPermission(member);
                          setShowPermissionModal(true);
                        }}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 4,
                          backgroundColor: PERMISSION_COLORS[member.permission || 'viewer'],
                          marginRight: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: '#fff',
                            fontWeight: '600',
                            fontSize: 11,
                            textTransform: 'capitalize',
                          }}
                        >
                          {member.permission || 'viewer'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleRemoveMember(member.id)}>
                        <Text style={{ fontSize: 18, color: '#ff6b6b' }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 16,
              backgroundColor: '#fff',
              borderTopWidth: 1,
              borderTopColor: '#f0f0f0',
            }}
          >
            <TouchableOpacity
              onPress={handleSaveChanges}
              disabled={isLoading}
              style={{
                backgroundColor: isLoading ? '#ccc' : '#667eea',
                paddingVertical: 14,
                borderRadius: 8,
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Save Changes</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{
                paddingVertical: 14,
                borderRadius: 8,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#e0e0e0',
              }}
            >
              <Text style={{ color: '#666', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowDeleteConfirm(true)}
              style={{
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: 'center',
                marginTop: 12,
              }}
            >
              <Text style={{ color: '#ff6b6b', fontWeight: '600', fontSize: 14 }}>Delete Project</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Member Picker Modal */}
      <Modal visible={showMemberModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View
            style={{
              flex: 1,
              marginTop: 100,
              backgroundColor: '#fff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}
          >
            <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#000' }}>Add Team Members</Text>
            </View>

            <FlatList
              data={getAvailableMembers()}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleAddMember(item)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#f0f0f0',
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: '#667eea',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                      {getInitials(item.name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', fontSize: 15, color: '#000' }}>{item.name}</Text>
                    <Text style={{ fontSize: 13, color: '#999' }}>{item.email}</Text>
                  </View>
                  <Text style={{ fontSize: 20, color: '#667eea' }}>+</Text>
                </TouchableOpacity>
              )}
              scrollEnabled
            />

            <TouchableOpacity
              onPress={() => setShowMemberModal(false)}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 14,
                borderTopWidth: 1,
                borderTopColor: '#f0f0f0',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#667eea', textAlign: 'center' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Permission Picker Modal */}
      <Modal visible={showPermissionModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, paddingVertical: 0, overflow: 'hidden' }}>
            <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#000' }}>Change Permission</Text>
            </View>

            {(['admin', 'editor', 'viewer'] as const).map((permission) => (
              <TouchableOpacity
                key={permission}
                onPress={() => handlePermissionChange(permission)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: '#f0f0f0',
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: selectedMemberForPermission?.permission === permission ? PERMISSION_COLORS[permission] : '#ddd',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}
                >
                  {selectedMemberForPermission?.permission === permission && (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: PERMISSION_COLORS[permission],
                      }}
                    />
                  )}
                </View>
                <View>
                  <Text style={{ fontWeight: '600', fontSize: 15, color: '#000', textTransform: 'capitalize' }}>
                    {permission}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                    {permission === 'admin' && 'Full access to project'}
                    {permission === 'editor' && 'Can edit project and tasks'}
                    {permission === 'viewer' && 'View only access'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setShowPermissionModal(false)}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 14,
                backgroundColor: '#f5f7fa',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#667eea', textAlign: 'center' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};
