'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { taskApi, ActivityLog } from '@/lib/api';

// ── Action display config ──

const ACTION_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  'task.created': {
    icon: 'M12 4v16m8-8H4',
    color: 'text-green-600 bg-green-100 dark:bg-green-900/30',
    label: 'created',
  },
  'task.updated': {
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    label: 'updated',
  },
  'task.status_changed': {
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
    label: 'changed status',
  },
  'task.comment_added': {
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    color: 'text-teal-600 bg-teal-100 dark:bg-teal-900/30',
    label: 'commented on',
  },
  'task.assigned': {
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30',
    label: 'assigned',
  },
  'sprint.started': {
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
    label: 'started sprint',
  },
  'sprint.completed': {
    icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
    label: 'completed sprint',
  },
};

const DEFAULT_ACTION = {
  icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  color: 'text-gray-500 bg-gray-100 dark:bg-gray-800',
  label: 'updated',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDetails(action: string, details?: Record<string, any>): string {
  if (!details) return '';
  if (action === 'task.status_changed' && details.from && details.to) {
    return `${details.from} \u2192 ${details.to}`;
  }
  if (action === 'task.comment_added' && details.commentPreview) {
    return `"${details.commentPreview}"`;
  }
  if (action === 'sprint.completed' && details.velocity !== undefined) {
    return `${details.completedCount} done, ${details.incompleteCount} carried over (${details.velocity} SP)`;
  }
  return '';
}

interface ActivityFeedProps {
  projectId: string;
  limit?: number;
  className?: string;
}

export default function ActivityFeed({ projectId, limit = 30, className = '' }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = limit;

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const res = await taskApi.getProjectActivity(projectId, pageSize * page);
      setActivities(Array.isArray(res.data) ? res.data : []);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, page, pageSize]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const displayed = activities.slice(0, pageSize * page);
  const hasMore = activities.length >= pageSize * page;

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Activity Feed
        </h3>
        <button
          onClick={fetchActivities}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Activity list */}
      <div className="max-h-[28rem] overflow-y-auto">
        {loading && activities.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">No activity yet</p>
          </div>
        ) : (
          <div className="relative px-4 py-2">
            {/* Timeline line */}
            <div className="absolute left-[1.65rem] top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />

            {displayed.map((activity, idx) => {
              const config = ACTION_CONFIG[activity.action] || DEFAULT_ACTION;
              const detail = formatDetails(activity.action, activity.details);
              return (
                <div key={activity._id} className="relative flex items-start gap-3 pb-4 last:pb-2">
                  {/* Icon */}
                  <div className={`relative z-10 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${config.color}`}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-[13px] text-gray-800 dark:text-gray-200">
                      <span className="font-medium">{activity.actorName || activity.actorId}</span>
                      {' '}
                      <span className="text-gray-500">{config.label}</span>
                      {' '}
                      {activity.entityTitle && (
                        <span className="font-medium">{activity.entityTitle}</span>
                      )}
                    </p>
                    {detail && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {detail}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {timeAgo(activity.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="w-full text-center text-xs text-blue-600 dark:text-blue-400 hover:underline py-1"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
