import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../hooks/useAuth';
import { MainStackNavigationProp } from '../types/navigation';

interface SettingsScreenProps {
  navigation: MainStackNavigationProp;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { logout } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [offlineMode, setOfflineMode] = useState(true);
  const [biometricAuth, setBiometricAuth] = useState(false);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    value,
    onValueChange,
    onPress,
    isToggle = false,
  }: {
    icon?: string;
    title: string;
    subtitle?: string;
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    onPress?: () => void;
    isToggle?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={isToggle ? undefined : onPress}
      activeOpacity={isToggle ? 1 : 0.6}
    >
      <View style={styles.settingItemContent}>
        {icon && <Text style={styles.settingIcon}>{icon}</Text>}
        <View style={styles.settingTextContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {isToggle && value !== undefined ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#e0e0e0', true: '#667eea' }}
          thumbColor={value ? '#fff' : '#f0f0f0'}
        />
      ) : (
        <Text style={styles.settingArrow}>›</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={['#f5f7fa', '#f5f7fa']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.sectionContent}>
            <SettingItem
              icon="🔔"
              title="Push Notifications"
              subtitle="Receive task and project updates"
              value={notifications}
              onValueChange={setNotifications}
              isToggle
            />

            <SettingItem
              icon="📧"
              title="Email Notifications"
              subtitle="Receive important emails"
              onPress={() =>
                Alert.alert('Info', 'Email notification settings coming soon')
              }
            />

            <SettingItem
              icon="🔊"
              title="Sound"
              subtitle="Play sound for notifications"
              onPress={() =>
                Alert.alert('Info', 'Sound settings coming soon')
              }
            />
          </View>
        </View>

        {/* Display Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display</Text>
          <View style={styles.sectionContent}>
            <SettingItem
              icon="🌙"
              title="Dark Mode"
              subtitle="Use dark theme"
              value={darkMode}
              onValueChange={setDarkMode}
              isToggle
            />

            <SettingItem
              icon="🌍"
              title="Language"
              subtitle="English"
              onPress={() =>
                Alert.alert('Languages', 'Language settings coming soon')
              }
            />
          </View>
        </View>

        {/* Data & Sync Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Sync</Text>
          <View style={styles.sectionContent}>
            <SettingItem
              icon="📱"
              title="Offline Mode"
              subtitle="Work offline and sync later"
              value={offlineMode}
              onValueChange={setOfflineMode}
              isToggle
            />

            <SettingItem
              icon="♻️"
              title="Sync Now"
              subtitle="Manually sync your data"
              onPress={() => {
                Alert.alert('Success', 'Data synced successfully');
              }}
            />

            <SettingItem
              icon="🗑️"
              title="Clear Cache"
              subtitle="Remove cached data"
              onPress={() => {
                Alert.alert(
                  'Clear Cache',
                  'Are you sure? This will remove cached data.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: () => {
                        Alert.alert('Success', 'Cache cleared');
                      },
                    },
                  ]
                );
              }}
            />
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.sectionContent}>
            <SettingItem
              icon="🔐"
              title="Biometric Authentication"
              subtitle="Use fingerprint or face ID"
              value={biometricAuth}
              onValueChange={setBiometricAuth}
              isToggle
            />

            <SettingItem
              icon="🔑"
              title="Change Password"
              subtitle="Update your password"
              onPress={() =>
                Alert.alert(
                  'Change Password',
                  'Password change feature coming soon'
                )
              }
            />

            <SettingItem
              icon="🔒"
              title="Two-Factor Authentication"
              subtitle="Add extra security layer"
              onPress={() =>
                Alert.alert(
                  '2FA Setup',
                  'Two-factor authentication setup coming soon'
                )
              }
            />
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionContent}>
            <SettingItem
              icon="👤"
              title="Profile"
              subtitle="Edit your profile information"
              onPress={() => navigation.navigate('Profile')}
            />

            <SettingItem
              icon="📋"
              title="Privacy Policy"
              subtitle="View privacy policy"
              onPress={() =>
                Alert.alert('Privacy Policy', 'Privacy policy content here')
              }
            />

            <SettingItem
              icon="⚖️"
              title="Terms of Service"
              subtitle="View terms and conditions"
              onPress={() =>
                Alert.alert(
                  'Terms of Service',
                  'Terms and conditions content here'
                )
              }
            />
          </View>
        </View>

        {/* App Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About App</Text>
          <View style={styles.sectionContent}>
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>App Version</Text>
              <Text style={styles.aboutValue}>1.0.0</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>Build Number</Text>
              <Text style={styles.aboutValue}>1</Text>
            </View>

            <View style={styles.divider} />

            <SettingItem
              icon="🐛"
              title="Report a Bug"
              subtitle="Send us feedback"
              onPress={() =>
                Alert.alert('Report Bug', 'Bug report feature coming soon')
              }
            />

            <SettingItem
              icon="⭐"
              title="Rate This App"
              subtitle="Let us know what you think"
              onPress={() =>
                Alert.alert('Rate App', 'Redirecting to app store...')
              }
            />

            <SettingItem
              icon="ℹ️"
              title="Help & Support"
              subtitle="Get help with the app"
              onPress={() =>
                Alert.alert('Help & Support', 'Support page coming soon')
              }
            />
          </View>
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
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
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  settingItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    fontSize: 20,
  },
  settingTextContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#999',
  },
  settingArrow: {
    fontSize: 20,
    color: '#ccc',
    marginLeft: 12,
  },
  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  aboutLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  aboutValue: {
    fontSize: 14,
    color: '#999',
  },
  divider: {
    height: 1,
    backgroundColor: '#f5f5f5',
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#ff6b6b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutIcon: {
    fontSize: 18,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff6b6b',
  },
  bottomPadding: {
    height: 20,
  },
});
