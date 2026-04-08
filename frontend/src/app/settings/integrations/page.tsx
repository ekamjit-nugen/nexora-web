'use client';

import React, { useState } from 'react';

interface CalendarConnection {
  provider: 'google' | 'outlook';
  connected: boolean;
  email?: string;
  connectedAt?: string;
}

export default function IntegrationsPage() {
  const [connections, setConnections] = useState<CalendarConnection[]>([
    { provider: 'google', connected: false },
    { provider: 'outlook', connected: false },
  ]);
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = async (provider: 'google' | 'outlook') => {
    setConnecting(provider);

    // OAuth flow: redirect to backend auth endpoint
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const redirectUri = `${window.location.origin}/settings/integrations`;

    if (provider === 'google') {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        alert('Google Calendar integration is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID.');
        setConnecting(null);
        return;
      }
      const scope = 'https://www.googleapis.com/auth/calendar.events';
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
      window.location.href = authUrl;
    } else if (provider === 'outlook') {
      const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
      if (!clientId) {
        alert('Outlook Calendar integration is not configured. Please set NEXT_PUBLIC_MICROSOFT_CLIENT_ID.');
        setConnecting(null);
        return;
      }
      const scope = 'Calendars.ReadWrite offline_access';
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
      window.location.href = authUrl;
    }
  };

  const handleDisconnect = async (provider: 'google' | 'outlook') => {
    setConnections(prev =>
      prev.map(c => c.provider === provider ? { ...c, connected: false, email: undefined, connectedAt: undefined } : c),
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Calendar Integrations</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Connect your calendar to automatically sync Nexora meetings.
        </p>
      </div>

      <div className="space-y-4">
        {connections.map((connection) => (
          <div
            key={connection.provider}
            className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                {connection.provider === 'google' ? (
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                ) : (
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#0078D4" d="M2 3h9v9H2V3zm11 0h9v9h-9V3zM2 14h9v9H2v-9zm11 0h9v9h-9v-9z"/>
                  </svg>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  {connection.provider === 'google' ? 'Google Calendar' : 'Microsoft Outlook'}
                </h3>
                {connection.connected ? (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Connected{connection.email ? ` as ${connection.email}` : ''}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Not connected
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => connection.connected ? handleDisconnect(connection.provider) : handleConnect(connection.provider)}
              disabled={connecting === connection.provider}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                connection.connected
                  ? 'text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
                  : 'text-white bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {connecting === connection.provider
                ? 'Connecting...'
                : connection.connected
                  ? 'Disconnect'
                  : 'Connect'}
            </button>
          </div>
        ))}
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300">How it works</h3>
        <ul className="mt-2 text-xs text-blue-700 dark:text-blue-400 space-y-1">
          <li>When you schedule a meeting in Nexora, it will automatically appear in your connected calendar</li>
          <li>Meeting updates (reschedule, cancel) sync automatically</li>
          <li>Calendar events include a direct link to join the Nexora meeting</li>
        </ul>
      </div>
    </div>
  );
}
