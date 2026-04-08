'use client';

import React, { useState } from 'react';
import { Task } from '@/lib/api';

type GitLink = NonNullable<Task['gitLinks']>[number];

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function GitLabIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 14.5l2.95-9.08H5.05L8 14.5z" />
      <path d="M8 14.5L5.05 5.42H1.16L8 14.5z" opacity=".7" />
      <path d="M1.16 5.42l-.95 2.93c-.09.27 0 .56.22.73L8 14.5 1.16 5.42z" opacity=".5" />
      <path d="M1.16 5.42h3.89L3.4.66c-.1-.3-.52-.3-.62 0L1.16 5.42z" />
      <path d="M8 14.5l2.95-9.08h3.89L8 14.5z" opacity=".7" />
      <path d="M14.84 5.42l.95 2.93c.09.27 0 .56-.22.73L8 14.5l6.84-9.08z" opacity=".5" />
      <path d="M14.84 5.42h-3.89L12.6.66c.1-.3.52-.3.62 0l1.62 4.76z" />
    </svg>
  );
}

function BitbucketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M.778 1.213a.768.768 0 00-.768.892l2.17 13.095a.768.768 0 00.758.631h10.07a.564.564 0 00.56-.475L15.99 2.105a.768.768 0 00-.768-.892H.778zm8.938 9.34H6.284L5.666 6.4h4.669l-.619 4.153z" />
    </svg>
  );
}

function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  switch (provider) {
    case 'github':
      return <GitHubIcon className={className} />;
    case 'gitlab':
      return <GitLabIcon className={className} />;
    case 'bitbucket':
      return <BitbucketIcon className={className} />;
    default:
      return <GitHubIcon className={className} />;
  }
}

function PrStatusBadge({ status }: { status?: string }) {
  switch (status) {
    case 'merged':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 16 16">
            <path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218zM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zm8-9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" />
          </svg>
          Merged
        </span>
      );
    case 'open':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 16 16">
            <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354z" />
          </svg>
          Open
        </span>
      );
    case 'closed':
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Closed
        </span>
      );
    default:
      return null;
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface GitActivitySectionProps {
  gitLinks: GitLink[];
}

export function GitActivitySection({ gitLinks }: GitActivitySectionProps) {
  const [expanded, setExpanded] = useState(true);

  if (!gitLinks || gitLinks.length === 0) return null;

  const commits = gitLinks.filter((l) => l.type === 'commit');
  const pullRequests = gitLinks.filter((l) => l.type === 'pull_request');
  const branches = gitLinks.filter((l) => l.type === 'branch');

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-3"
      >
        <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center gap-2 cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
          </svg>
          Development ({gitLinks.length})
        </label>
        <svg
          className={`w-4 h-4 text-[#94A3B8] transition-transform ${expanded ? '' : '-rotate-90'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-3">
          {/* Pull Requests */}
          {pullRequests.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#94A3B8] mb-1.5 flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Pull Requests ({pullRequests.length})
              </p>
              {pullRequests.map((pr, idx) => (
                <a
                  key={pr._id || idx}
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-sm mb-1.5 transition-all group"
                >
                  <ProviderIcon provider={pr.provider} className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                  <span className="text-[11px] font-mono text-[#2E86C1] shrink-0">#{pr.number}</span>
                  <span className="text-[12px] text-[#0F172A] flex-1 truncate group-hover:text-[#2E86C1]">{pr.title}</span>
                  <PrStatusBadge status={pr.status} />
                  <span className="text-[10px] text-[#94A3B8] shrink-0">{pr.author}</span>
                </a>
              ))}
            </div>
          )}

          {/* Commits */}
          {commits.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#94A3B8] mb-1.5 flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                </svg>
                Commits ({commits.length})
              </p>
              {commits.map((commit, idx) => (
                <a
                  key={commit._id || idx}
                  href={commit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-sm mb-1.5 transition-all group"
                >
                  <ProviderIcon provider={commit.provider} className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                  <span className="text-[10px] font-mono text-[#2E86C1] shrink-0 bg-[#EBF5FB] px-1.5 py-0.5 rounded">
                    {commit.sha?.slice(0, 7)}
                  </span>
                  <span className="text-[12px] text-[#0F172A] flex-1 truncate group-hover:text-[#2E86C1]">{commit.title}</span>
                  <span className="text-[10px] text-[#94A3B8] shrink-0">{commit.author}</span>
                  <span className="text-[10px] text-[#CBD5E1] shrink-0">{commit.createdAt ? formatDate(commit.createdAt) : ''}</span>
                </a>
              ))}
            </div>
          )}

          {/* Branches */}
          {branches.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#94A3B8] mb-1.5 flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Branches ({branches.length})
              </p>
              {branches.map((br, idx) => (
                <a
                  key={br._id || idx}
                  href={br.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-sm mb-1.5 transition-all group"
                >
                  <ProviderIcon provider={br.provider} className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                  <span className="text-[11px] font-mono text-[#0F172A] group-hover:text-[#2E86C1]">
                    {br.branch || br.title}
                  </span>
                  <span className="text-[10px] text-[#94A3B8] ml-auto shrink-0">{br.repository}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Badge for task cards on board view ──

export function GitLinksBadge({ gitLinks }: { gitLinks?: GitLink[] }) {
  if (!gitLinks || gitLinks.length === 0) return null;

  const prCount = gitLinks.filter((l) => l.type === 'pull_request').length;
  const commitCount = gitLinks.filter((l) => l.type === 'commit').length;
  const total = prCount + commitCount;

  if (total === 0) return null;

  const hasMergedPr = gitLinks.some((l) => l.type === 'pull_request' && l.status === 'merged');
  const hasOpenPr = gitLinks.some((l) => l.type === 'pull_request' && l.status === 'open');

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
        hasMergedPr
          ? 'bg-purple-50 text-purple-600 border border-purple-200'
          : hasOpenPr
            ? 'bg-green-50 text-green-600 border border-green-200'
            : 'bg-gray-50 text-gray-500 border border-gray-200'
      }`}
      title={`${prCount} PR${prCount !== 1 ? 's' : ''}, ${commitCount} commit${commitCount !== 1 ? 's' : ''}`}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
      {total}
    </span>
  );
}
