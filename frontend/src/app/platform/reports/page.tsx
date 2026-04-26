"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { platformApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";

interface ReportTemplate {
  _id: string;
  name: string;
  description: string;
  type: string;
  format: string;
  createdAt: string;
}

export default function ReportsPage() {
  const { user, loading, isPlatformAdmin } = useAuth();
  const router = useRouter();

  const handleLogout = useCallback(() => {
    router.push("/");
  }, [router]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "organizations",
    format: "pdf",
  });

  const fetchTemplates = useCallback(async () => {
    setDataLoading(true);
    try {
      const res = await platformApi.getReportTemplates();
      setTemplates((res.data || []) as ReportTemplate[]);
    } catch (error) {
      toast.error("Failed to load report templates");
      console.error(error);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchTemplates();
    }
  }, [loading, fetchTemplates]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await platformApi.createReportTemplate({
        name: formData.name,
        description: formData.description,
        type: formData.type,
        format: formData.format as "pdf" | "excel" | "csv",
      });

      toast.success("Report template created successfully");
      setFormData({ name: "", description: "", type: "organizations", format: "pdf" });
      setShowForm(false);
      fetchTemplates();
    } catch (error) {
      toast.error("Failed to create report template");
      console.error(error);
    }
  };

  const handleGenerateReport = async (template: ReportTemplate) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://192.168.29.218:3005"}/api/v1/reports/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          type: template.type,
          format: template.format,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate report");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.name}.${template.format === "excel" ? "xlsx" : template.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Report generated successfully");
    } catch (error) {
      toast.error("Failed to generate report");
      console.error(error);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      await platformApi.deleteReportTemplate(templateId);
      toast.success("Template deleted successfully");
      fetchTemplates();
    } catch (error) {
      toast.error("Failed to delete template");
      console.error(error);
    }
  };

  return (
    <RouteGuard minOrgRole="admin">
      <div className="flex h-screen bg-gray-50">
        {user && <Sidebar user={user} onLogout={handleLogout} />}

        <div className="flex-1 flex flex-col">
          <div className="bg-white border-b border-gray-200 px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-600 mt-2">Create and manage reports for your organization</p>
          </div>

          <div className="flex-1 overflow-auto p-8">
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">Organizations Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm mb-4">Generate a report of all organizations</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setFormData({
                          name: "Organizations Report",
                          description: "Report of all organizations",
                          type: "organizations",
                          format: "pdf",
                        });
                        setShowForm(true);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    >
                      Create
                    </button>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">Users Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm mb-4">Generate a report of all platform users</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setFormData({
                          name: "Users Report",
                          description: "Report of all platform users",
                          type: "users",
                          format: "excel",
                        });
                        setShowForm(true);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    >
                      Create
                    </button>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">Audit Logs Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm mb-4">Generate audit logs report for compliance</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setFormData({
                          name: "Audit Logs Report",
                          description: "Compliance audit logs report",
                          type: "audit-logs",
                          format: "csv",
                        });
                        setShowForm(true);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    >
                      Create
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Report Form */}
            {showForm && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Create New Report Template</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateTemplate} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Template Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Monthly Organization Report"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Describe what this report contains"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
                        <select
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="organizations">Organizations</option>
                          <option value="users">Users</option>
                          <option value="analytics">Analytics</option>
                          <option value="audit-logs">Audit Logs</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                        <select
                          value={formData.format}
                          onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="pdf">PDF</option>
                          <option value="excel">Excel</option>
                          <option value="csv">CSV</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
                      >
                        Create Template
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Templates List */}
            <Card>
              <CardHeader>
                <CardTitle>Report Templates</CardTitle>
              </CardHeader>
              <CardContent>
                {dataLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading templates...</div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No report templates created yet</p>
                    <button
                      onClick={() => setShowForm(true)}
                      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      Create First Template
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                          <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Description</th>
                          <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Type</th>
                          <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Format</th>
                          <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {templates.map((template) => (
                          <tr key={template._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{template.name}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{template.description}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                {template.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{template.format.toUpperCase()}</td>
                            <td className="px-6 py-4 text-sm space-x-2">
                              <button
                                onClick={() => handleGenerateReport(template)}
                                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs font-medium"
                              >
                                Generate
                              </button>
                              <button
                                onClick={() => handleDeleteTemplate(template._id)}
                                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs font-medium"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
