'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { integrationApi, GitIntegrationConfig } from '@/lib/api';
import { toast } from 'sonner';

interface CalendarConnection {
  provider: 'google' | 'outlook';
  connected: boolean;
  email?: string;
  connectedAt?: string;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg font-mono text-gray-700 dark:text-gray-300 break-all select-all">
        {text}
      </code>
      <button
        onClick={handleCopy}
        className="shrink-0 px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

function GitIntegrationSection() {
  const [configs, setConfigs] = useState<GitIntegrationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [setting, setSetting] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'github' | 'gitlab'>('github');
  const [autoTransition, setAutoTransition] = useState(false);
  const [autoTransitionTarget, setAutoTransitionTarget] = useState('done');
  const [showSetup, setShowSetup] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await integrationApi.getGitConfig();
      setConfigs(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Not configured yet
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleSetup = async () => {
    setSetting(true);
    try {
      await integrationApi.setupGit({
        provider: selectedProvider,
        autoTransition,
        autoTransitionTarget,
      });
      toast.success(`${selectedProvider === 'github' ? 'GitHub' : 'GitLab'} integration configured`);
      setShowSetup(false);
      await fetchConfigs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to setup integration');
    } finally {
      setSetting(false);
    }
  };

  const handleRemove = async (provider: string) => {
    if (!confirm(`Remove ${provider} integration? Webhook will stop working.`)) return;
    try {
      await integrationApi.removeGitConfig(provider);
      toast.success('Integration removed');
      await fetchConfigs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove');
    }
  };

  const providerLabel = (p: string) => {
    switch (p) {
      case 'github': return 'GitHub';
      case 'gitlab': return 'GitLab';
      case 'bitbucket': return 'Bitbucket';
      default: return p;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Git Integration</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Link commits and pull requests to tasks automatically.
          </p>
        </div>
        {!showSetup && (
          <button
            onClick={() => setShowSetup(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            + Add Provider
          </button>
        )}
      </div>

      {/* Setup Form */}
      {showSetup && (
        <div className="p-5 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Configure Git Provider</h3>

          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Provider</label>
            <div className="flex gap-2">
              {(['github', 'gitlab'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedProvider(p)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    selectedProvider === p
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {p === 'github' ? (
                    <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 14.5l2.95-9.08H5.05L8 14.5z" />
                      <path d="M8 14.5L5.05 5.42H1.16L8 14.5z" opacity=".7" />
                      <path d="M1.16 5.42l-.95 2.93c-.09.27 0 .56.22.73L8 14.5 1.16 5.42z" opacity=".5" />
                      <path d="M1.16 5.42h3.89L3.4.66c-.1-.3-.52-.3-.62 0L1.16 5.42z" />
                      <path d="M8 14.5l2.95-9.08h3.89L8 14.5z" opacity=".7" />
                      <path d="M14.84 5.42l.95 2.93c.09.27 0 .56-.22.73L8 14.5l6.84-9.08z" opacity=".5" />
                      <path d="M14.84 5.42h-3.89L12.6.66c.1-.3.52-.3.62 0l1.62 4.76z" />
                    </svg>
                  )}
                  {providerLabel(p)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoTransition}
                onChange={(e) => setAutoTransition(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Auto-transition tasks when PR is merged
              </span>
            </label>
          </div>

          {autoTransition && (
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Target Status</label>
              <select
                value={autoTransitionTarget}
                onChange={(e) => setAutoTransitionTarget(e.target.value)}
                className="w-full max-w-xs h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-white"
              >
                <option value="done">Done</option>
                <option value="in_review">In Review</option>
                <option value="todo">To Do</option>
              </select>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSetup}
              disabled={setting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {setting ? 'Setting up...' : 'Configure'}
            </button>
            <button
              onClick={() => setShowSetup(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active Configurations */}
      {loading ? (
        <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
      ) : configs.length === 0 && !showSetup ? (
        <div className="p-8 text-center border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <svg className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No git integrations configured</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Add a provider to link commits and PRs to tasks
          </p>
        </div>
      ) : (
        configs.map((config) => (
          <div key={config.provider} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  {config.provider === 'github' ? (
                    <svg className="w-6 h-6" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 14.5l2.95-9.08H5.05L8 14.5z" />
                      <path d="M8 14.5L5.05 5.42H1.16L8 14.5z" opacity=".7" />
                      <path d="M14.84 5.42l.95 2.93c.09.27 0 .56-.22.73L8 14.5l6.84-9.08z" opacity=".5" />
                      <path d="M14.84 5.42h-3.89L12.6.66c.1-.3.52-.3.62 0l1.62 4.76z" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    {providerLabel(config.provider)}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center gap-1 text-xs ${config.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${config.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {config.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {config.lastWebhookAt && (
                      <span className="text-xs text-gray-400">
                        Last event: {new Date(config.lastWebhookAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRemove(config.provider)}
                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              >
                Remove
              </button>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/50 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Webhook URL</label>
                <CopyButton text={config.webhookUrl} label="URL" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Webhook Secret</label>
                <CopyButton text={config.webhookSecret} label="Secret" />
              </div>

              {config.autoTransition && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Auto-transition enabled: tasks move to <span className="font-medium text-gray-700 dark:text-gray-300">{config.autoTransitionTarget}</span> when PR is merged
                </p>
              )}

              {/* Setup Instructions */}
              <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Setup Instructions for {providerLabel(config.provider)}
                </h4>
                {config.provider === 'github' ? (
                  <ol className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5 list-decimal list-inside">
                    <li>Go to your GitHub repository Settings &gt; Webhooks</li>
                    <li>Click "Add webhook"</li>
                    <li>Paste the <strong>Webhook URL</strong> above into "Payload URL"</li>
                    <li>Set Content type to <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">application/json</code></li>
                    <li>Paste the <strong>Webhook Secret</strong> above into "Secret"</li>
                    <li>Select events: <strong>Pushes</strong> and <strong>Pull requests</strong></li>
                    <li>Click "Add webhook" to save</li>
                  </ol>
                ) : (
                  <ol className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5 list-decimal list-inside">
                    <li>Go to your GitLab project Settings &gt; Webhooks</li>
                    <li>Paste the <strong>Webhook URL</strong> above into "URL"</li>
                    <li>Paste the <strong>Webhook Secret</strong> above into "Secret token"</li>
                    <li>Check triggers: <strong>Push events</strong> and <strong>Merge request events</strong></li>
                    <li>Click "Add webhook" to save</li>
                  </ol>
                )}
              </div>

              <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Include task keys like <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">PROJ-123</code> in commit messages or PR titles to link them automatically.
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
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
    <div className="space-y-10">
      {/* Git Integration */}
      <GitIntegrationSection />

      <div className="border-t border-gray-200 dark:border-gray-700" />

      {/* Calendar Integrations */}
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
