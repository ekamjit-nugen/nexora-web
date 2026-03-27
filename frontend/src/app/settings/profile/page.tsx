"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { authApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [timezone, setTimezone] = useState("");
  const [bio, setBio] = useState("");
  const [linkedIn, setLinkedIn] = useState("");
  const [github, setGithub] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      const u = user as any;
      setFirstName(u.firstName || "");
      setLastName(u.lastName || "");
      setPhone(u.phone || "");
      setAvatar(u.avatar || "");
      setJobTitle(u.jobTitle || u.designation || "");
      setDepartment(u.department || "");
      setLocation(u.location || "");
      setTimezone(u.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "");
      setBio(u.bio || "");
      setLinkedIn(u.linkedIn || "");
      setGithub(u.github || "");
    }
  }, [user]);

  if (!user) return null;

  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  const primaryRole = ["super_admin", "admin", "hr", "manager", "developer", "designer", "employee"].find((r) => user.roles?.includes(r)) || user.role || "member";

  const handleAvatarUpload = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") setAvatar(reader.result); };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005"}/api/v1/auth/me`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ firstName, lastName, phone, avatar: avatar || undefined, jobTitle, department, location, timezone, bio, linkedIn, github }),
        }
      );
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed"); }
      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const timezones = [
    "Asia/Kolkata", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai",
    "Asia/Dubai", "Asia/Singapore", "Australia/Sydney", "Pacific/Auckland",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#0F172A]">Profile</h2>
        <p className="text-[13px] text-[#94A3B8] mt-1">Manage your personal information and preferences</p>
      </div>

      {/* Avatar section */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[#2E86C1] to-[#60A5FA] relative">
          <div className="absolute -bottom-10 left-6">
            <div className="relative group">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-lg" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#2E86C1] to-[#1A5276] flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-lg">
                  {initials}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all"
              >
                <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleAvatarUpload(e.target.files[0]); e.target.value = ""; }} />
            </div>
          </div>
        </div>
        <CardContent className="pt-14 pb-5 px-6">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#0F172A]">{user.firstName} {user.lastName}</h3>
              <p className="text-[13px] text-[#64748B]">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#EBF5FB] text-[#2E86C1] capitalize">{primaryRole.replace("_", " ")}</span>
                {jobTitle && <span className="text-[11px] text-[#94A3B8]">&middot; {jobTitle}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {avatar && (
                <Button variant="outline" onClick={() => setAvatar("")} className="h-8 text-[12px] border-[#E2E8F0] text-[#64748B]">Remove Photo</Button>
              )}
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="h-8 text-[12px] border-[#E2E8F0] text-[#64748B]">
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Change Photo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-[14px] font-bold text-[#0F172A] mb-5 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Personal Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">First Name</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Last Name</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Email</label>
              <div className="relative">
                <Input value={user.email} readOnly className="h-11 text-sm bg-[#F1F5F9] border-[#E2E8F0] text-[#94A3B8] cursor-not-allowed pr-10" />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#CBD5E1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Phone Number</label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Information */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-[14px] font-bold text-[#0F172A] mb-5 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>
            Work Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Job Title</label>
              <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g., Senior Developer" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Department</label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g., Engineering" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Location</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Bengaluru, India" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0]" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Timezone</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full h-11 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]">
                <option value="">Select timezone</option>
                {timezones.map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bio */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-[14px] font-bold text-[#0F172A] mb-5 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
            About
          </h3>
          <div>
            <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your team a little about yourself..."
              rows={4}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#2E86C1] focus:border-transparent resize-y"
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-[14px] font-bold text-[#0F172A] mb-5 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
            Social Links
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">LinkedIn</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm">linkedin.com/in/</span>
                <Input value={linkedIn} onChange={(e) => setLinkedIn(e.target.value)} placeholder="username" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0] pl-[120px]" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5 block">GitHub</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm">github.com/</span>
                <Input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="username" className="h-11 text-sm bg-[#F8FAFC] border-[#E2E8F0] pl-[96px]" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pt-2 pb-8">
        <Button variant="outline" className="h-10 border-[#E2E8F0] text-[#64748B]">Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="h-10 min-w-[140px] bg-gradient-to-r from-[#2E86C1] to-[#2471A3] hover:from-[#2471A3] hover:to-[#1A5276] shadow-sm">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
