import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  permission: 'admin' | 'editor' | 'viewer';
  joinedDate: string;
  status: 'active' | 'pending' | 'inactive';
}

interface ProjectMembersScreenProps {
  navigation: any;
  route?: any;
}

const MOCK_MEMBERS: TeamMember[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    permission: 'admin',
    joinedDate: '2026-01-15',
    status: 'active',
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    permission: 'editor',
    joinedDate: '2026-02-01',
    status: 'active',
  },
  {
    id: '3',
    name: 'Carol Davis',
    email: 'carol@example.com',
    permission: 'editor',
    joinedDate: '2026-02-15',
    status: 'active',
  },
  {
    id: '4',
    name: 'David Lee',
    email: 'david@example.com',
    permission: 'viewer',
    joinedDate: '2026-03-01',
    status: 'pending',
  },
];

const PERMISSION_COLORS: { [key: string]: string } = {
  admin: '#ff6b6b',
  editor: '#667eea',
  viewer: '#999',
};

const STATUS_COLORS: { [key: string]: string } = {
  active: '#51cf66',
  pending: '#ffd93d',
  inactive: '#999',
};

export const ProjectMembersScreen: React.FC<ProjectMembersScreenProps> = ({ navigation, route }) => {
  const projectId = route?.params?.projectId || '1';
  const [members, setMembers] = useState<TeamMember[]>(MOCK_MEMBERS);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [filterBy, setFilterBy] = useState<'all' | 'active' | 'pending'>('all');

  useEffect(() => {
    // Load members from API in real app
    // For now, using mock data
  }, [projectId]);

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getFilteredMembers = () => {
    let filtered = members;

    if (filterBy !== 'all') {
      filtered = filtered.filter((m) => m.status === filterBy);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const handlePermissionChange = async (newPermission: 'admin' | 'editor' | 'viewer') => {
    if (!selectedMember) return;

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setMembers(
        members.map((m) =>
          m.id === selectedMember.id
            ? { ...m, permission: newPermission }
            : m
        )
      );
      setShowPermissionModal(false);
      setSelectedMember(null);
      Alert.alert('Success', `Permission updated to ${newPermission}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update permission');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    Alert.alert('Remove Member', `Remove ${memberName} from project?`, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Remove',
        onPress: async () => {
          setIsLoading(true);
          try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1000));
            setMembers(members.filter((m) => m.id !== memberId));
            Alert.alert('Success', `${memberName} removed from project`);
          } catch (error) {
            Alert.alert('Error', 'Failed to remove member');
          } finally {
            setIsLoading(false);
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const handleResendInvitation = (memberId: string, memberEmail: string) => {
    Alert.alert('Resend Invitation', `Send invitation to ${memberEmail}?`, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Send',
        onPress: async () => {
          setIsLoading(true);
          try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 800));
            Alert.alert('Success', `Invitation sent to ${memberEmail}`);
          } catch (error) {
            Alert.alert('Error', 'Failed to send invitation');
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  const filteredMembers = getFilteredMembers();

  return (
    <LinearGradient colors={['#f5f7fa', '#e9ecef']} style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#fff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={{ fontSize: 24 }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#000' }}>Project Members</Text>
            <View style={{ width: 24 }} />
          </View>
        </View>

        {/* Member Count Summary */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: '#666' }}>Total Members: {members.length}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#51cf66' }} />
                <Text style={{ fontSize: 11, color: '#666' }}>{members.filter((m) => m.status === 'active').length}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffd93d' }} />
                <Text style={{ fontSize: 11, color: '#666' }}>{members.filter((m) => m.status === 'pending').length}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff' }}>
          <TextInput
            placeholder="Search members..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              borderWidth: 1,
              borderColor: '#e0e0e0',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              color: '#000',
            }}
          />
        </View>

        {/* Filter Tabs */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['all', 'active', 'pending'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                onPress={() => setFilterBy(filter)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                  backgroundColor: filterBy === filter ? '#667eea' : '#f0f0f0',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: filterBy === filter ? '#fff' : '#666',
                    textTransform: 'capitalize',
                  }}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Members List */}
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
            {filteredMembers.length === 0 ? (
              <View
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  padding: 24,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, color: '#999' }}>No members found</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }}>
                {filteredMembers.map((member, index) => (
                  <View
                    key={member.id}
                    style={{
                      borderBottomWidth: index < filteredMembers.length - 1 ? 1 : 0,
                      borderBottomColor: '#f0f0f0',
                    }}
                  >
                    <View style={{ padding: 16 }}>
                      {/* Member Header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: '#667eea',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 12,
                            position: 'relative',
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                            {getInitials(member.name)}
                          </Text>
                          <View
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: STATUS_COLORS[member.status],
                              borderWidth: 2,
                              borderColor: '#fff',
                            }}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '600', fontSize: 15, color: '#000' }}>{member.name}</Text>
                          <Text style={{ fontSize: 12, color: '#999' }}>{member.email}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedMember(member);
                            setShowPermissionModal(true);
                          }}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 4,
                            backgroundColor: PERMISSION_COLORS[member.permission],
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
                            {member.permission}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Member Details */}
                      <View
                        style={{
                          backgroundColor: '#f5f7fa',
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          marginBottom: 12,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ fontSize: 12, color: '#666' }}>Joined</Text>
                          <Text style={{ fontSize: 12, color: '#000', fontWeight: '500' }}>
                            {formatDate(member.joinedDate)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, color: '#666' }}>Status</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: STATUS_COLORS[member.status],
                              }}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                color: '#000',
                                fontWeight: '500',
                                textTransform: 'capitalize',
                              }}
                            >
                              {member.status}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Action Buttons */}
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {member.status === 'pending' && (
                          <TouchableOpacity
                            onPress={() => handleResendInvitation(member.id, member.email)}
                            style={{
                              flex: 1,
                              paddingVertical: 8,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: '#667eea',
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#667eea' }}>Resend</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => handleRemoveMember(member.id, member.name)}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: '#ff6b6b',
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#ff6b6b' }}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {isLoading && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.3)',
            }}
          >
            <ActivityIndicator size="large" color="#667eea" />
          </View>
        )}
      </View>

      {/* Permission Change Modal */}
      <Modal visible={showPermissionModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, paddingVertical: 0, overflow: 'hidden' }}>
            <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#000' }}>Change Permission</Text>
              <Text style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{selectedMember?.name}</Text>
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
                    borderColor:
                      selectedMember?.permission === permission
                        ? PERMISSION_COLORS[permission]
                        : '#ddd',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}
                >
                  {selectedMember?.permission === permission && (
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
    </LinearGradient>
  );
};
