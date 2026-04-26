"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { orgApi, roleApi } from "@/lib/api";
import type { User } from "@/lib/api";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";

interface MemberDisplay {
  _id: string;
  userId: string;
  role: string;
  status: string;
  user?: User;
}

const roleColors: Record<string, string> = {
  admin: "bg-red-50 text-red-700 border-red-200",
  super_admin: "bg-purple-50 text-purple-700 border-purple-200",
  hr: "bg-blue-50 text-blue-700 border-blue-200",
  manager: "bg-amber-50 text-amber-700 border-amber-200",
  employee: "bg-emerald-50 text-emerald-700 border-emerald-200",
  developer: "bg-cyan-50 text-cyan-700 border-cyan-200",
  designer: "bg-pink-50 text-pink-700 border-pink-200",
  member: "bg-gray-50 text-gray-700 border-gray-200",
  viewer: "bg-slate-50 text-slate-600 border-slate-200",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  invited: "bg-amber-50 text-amber-700 border-amber-200",
  inactive: "bg-gray-50 text-gray-600 border-gray-200",
};

export default function MembersSettingsPage() {
  const { user, currentOrg } = useAuth();
  const [members, setMembers] = useState<MemberDisplay[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);

  const userRoles = user?.roles || [];
  const isAdminOrHr = userRoles.some((r) => ["admin", "super_admin", "hr"].includes(r));

  const fetchMembers = useCallback(async () => {
    if (!currentOrg) return;
    setLoadingMembers(true);
    try {
      const [membersRes, usersRes] = await Promise.all([
        orgApi.getMembers(currentOrg._id),
        roleApi.getUsers().catch(() => ({ data: [] })),
      ]);

      const memberList = (membersRes.data || []) as unknown as MemberDisplay[];
      const userList = (usersRes.data || []) as User[];

      // Enrich members with user data
      const enriched = memberList.map((m) => ({
        ...m,
        user: userList.find((u) => u._id === m.userId),
      }));
      setMembers(enriched);
    } catch {
      // silent fail
    } finally {
      setLoadingMembers(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    if (currentOrg && isAdminOrHr) {
      fetchMembers();
    }
  }, [currentOrg, isAdminOrHr, fetchMembers]);

  if (!user) return null;

  if (!isAdminOrHr) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[#0F172A]">Access Denied</h2>
        <p className="text-sm text-[#64748B] mt-1">You do not have permission to view this page.</p>
      </div>
    );
  }

  const handleInvite = async () => {
    if (!inviteEmail || !currentOrg) {
      toast.error("Please enter an email address");
      return;
    }
    setInviting(true);
    try {
      await orgApi.invite(currentOrg._id, { email: inviteEmail, role: inviteRole });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteRole("member");
      await fetchMembers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send invitation";
      toast.error(message);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, userId: string, newRole: string) => {
    if (!currentOrg) return;
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://192.168.29.218:3005"}/api/v1/auth/organizations/${currentOrg._id}/members/${memberId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role: newRole }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to update role");
      }
      toast.success("Role updated");
      await fetchMembers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update role";
      toast.error(message);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!currentOrg) return;
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://192.168.29.218:3005"}/api/v1/auth/organizations/${currentOrg._id}/members/${memberId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to remove member");
      }
      toast.success("Member removed");
      setRemoveConfirm(null);
      await fetchMembers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove member";
      toast.error(message);
    }
  };

  const activeMembers = members.filter((m) => m.status === "active");
  const pendingMembers = members.filter((m) => m.status === "invited");

  return (
    <RouteGuard minOrgRole="admin">
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0F172A]">Members</h2>
        <p className="text-[13px] text-[#64748B] mt-1">
          Manage team members and invitations for your organization.
        </p>
      </div>

      {/* Invite Section */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Invite Member</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            placeholder="Enter email address"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none cursor-pointer"
          >
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail}
            className="bg-[#2E86C1] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#2874A6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {inviting ? "Sending..." : "Send Invite"}
          </button>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-4">
          Active Members ({activeMembers.length})
        </h3>

        {loadingMembers ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-6 w-6 text-[#2E86C1]" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : activeMembers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-[#64748B]">No active members found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeMembers.map((member) => {
              const memberUser = member.user;
              const initials = memberUser
                ? `${memberUser.firstName?.[0] || ""}${memberUser.lastName?.[0] || ""}`.toUpperCase()
                : "??";
              const name = memberUser
                ? `${memberUser.firstName} ${memberUser.lastName}`
                : member.userId;
              const email = memberUser?.email || "";
              const isCurrentUser = memberUser?._id === user._id;

              return (
                <div
                  key={member._id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]"
                >
                  <div className="w-10 h-10 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-sm font-semibold shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">
                      {name}
                      {isCurrentUser && (
                        <span className="text-xs text-[#64748B] ml-1.5">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-[#64748B] truncate">{email}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${
                        roleColors[member.role] || roleColors.member
                      }`}
                    >
                      {member.role.replace("_", " ")}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${
                        statusColors[member.status] || statusColors.active
                      }`}
                    >
                      {member.status}
                    </span>
                    {!isCurrentUser && (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member._id, member.userId, e.target.value)}
                        className="text-xs rounded-lg border border-[#E2E8F0] px-2 py-1.5 bg-white text-[#334155] cursor-pointer outline-none"
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    )}
                    {!isCurrentUser && (
                      <>
                        {removeConfirm === member._id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleRemove(member._id)}
                              className="text-xs text-red-600 font-medium hover:underline px-2 py-1"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setRemoveConfirm(null)}
                              className="text-xs text-[#64748B] font-medium hover:underline px-2 py-1"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setRemoveConfirm(member._id)}
                            className="text-xs text-red-500 font-medium hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {pendingMembers.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">
            Pending Invitations ({pendingMembers.length})
          </h3>
          <div className="space-y-2">
            {pendingMembers.map((member) => {
              const memberUser = member.user;
              const email = memberUser?.email || member.userId;
              return (
                <div
                  key={member._id}
                  className="flex items-center justify-between p-4 rounded-lg bg-amber-50/50 border border-amber-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">{email}</p>
                      <p className="text-xs text-amber-600">Invitation pending</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${
                        roleColors[member.role] || roleColors.member
                      }`}
                    >
                      {member.role}
                    </span>
                    <button
                      onClick={() => handleRemove(member._id)}
                      className="text-xs text-red-500 font-medium hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
    </RouteGuard>
  );
}
