/**
 * Per-module Mongo connection tokens.
 *
 * Each module declares its own logical database name. Today they all
 * point at the same Mongo instance via different DB names; tomorrow you
 * can swap any single connection's URI for a dedicated cluster — caller
 * code stays identical because it injects by token, not by URI.
 *
 * The token == the database name (e.g. `nexora_auth`) so the mapping is
 * transparent. To add a new module's connection, append to the array
 * below — the DatabaseModule's factory wires the rest.
 */
export const AUTH_DB = 'nexora_auth';
export const HR_DB = 'nexora_hr';
export const PAYROLL_DB = 'nexora_payroll';
export const ATTENDANCE_DB = 'nexora_attendance';
export const LEAVE_DB = 'nexora_leave';
export const POLICY_DB = 'nexora_policy';
export const ASSET_DB = 'nexora_asset';
export const HELPDESK_DB = 'nexora_helpdesk';
export const KNOWLEDGE_DB = 'nexora_knowledge';
export const CHAT_DB = 'nexora_chat';
export const CALLING_DB = 'nexora_calling';
export const MEDIA_DB = 'nexora_media';
export const NOTIFICATION_DB = 'nexora_notification';
export const AI_DB = 'nexora_ai';
export const BENCH_DB = 'nexora_bench';
export const TASK_DB = 'nexora_task';
export const PROJECT_DB = 'nexora_project';

export const ALL_DB_NAMES = [
  AUTH_DB, HR_DB, PAYROLL_DB, ATTENDANCE_DB, LEAVE_DB, POLICY_DB,
  ASSET_DB, HELPDESK_DB, KNOWLEDGE_DB, CHAT_DB, CALLING_DB, MEDIA_DB,
  NOTIFICATION_DB, AI_DB, BENCH_DB, TASK_DB, PROJECT_DB,
] as const;

export type DbName = typeof ALL_DB_NAMES[number];
