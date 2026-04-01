import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { useAuthStore } from './src/lib/store';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  useEffect(() => {
    // Initialize auth state when app starts
    const initAuth = async () => {
      try {
        const authStore = useAuthStore.getState();
        await authStore.initialize();
      } catch (err) {
        console.error('Failed to initialize auth:', err);
      }
    };

    initAuth();
  }, []);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <RootNavigator />
    </>
  );
}
