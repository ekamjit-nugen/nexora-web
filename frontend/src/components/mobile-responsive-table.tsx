"use client";

import { ReactNode } from "react";

export interface MobileTableColumn {
  key: string;
  label: string;
  width?: string;
  responsive?: "always" | "mobile" | "tablet" | "desktop";
  render?: (value: any, row: any) => ReactNode;
}

interface MobileResponsiveTableProps {
  columns: MobileTableColumn[];
  data: any[];
  rowKey: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  onRowClick?: (row: any) => void;
  renderRow?: (row: any) => ReactNode;
  emptyMessage?: string;
  loadingMessage?: string;
}

export const MobileResponsiveTable = ({
  columns,
  data,
  rowKey,
  isLoading = false,
  isEmpty = false,
  onRowClick,
  renderRow,
  emptyMessage = "No data found",
  loadingMessage = "Loading...",
}: MobileResponsiveTableProps) => {
  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">{loadingMessage}</div>;
  }

  if (isEmpty || data.length === 0) {
    return <div className="text-center py-8 text-gray-500">{emptyMessage}</div>;
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-6 py-3 text-left text-sm font-medium text-gray-700 ${col.width || ""}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((row) => (
              <tr
                key={row[rowKey]}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? "hover:bg-gray-50 cursor-pointer" : "hover:bg-gray-50"}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-4 text-sm text-gray-900">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {data.map((row) => (
          <div
            key={row[rowKey]}
            onClick={() => onRowClick?.(row)}
            className={`bg-white rounded-lg border border-gray-200 p-4 space-y-2 ${
              onRowClick ? "cursor-pointer active:bg-gray-50" : ""
            }`}
          >
            {renderRow ? (
              renderRow(row)
            ) : (
              columns.map((col) => (
                <div key={col.key} className="flex justify-between items-start">
                  <span className="text-xs font-medium text-gray-600">{col.label}</span>
                  <span className="text-sm text-gray-900 text-right">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </span>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </>
  );
};
