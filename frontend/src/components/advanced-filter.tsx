"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface FilterCondition {
  field: string;
  operator: "equals" | "contains" | "gt" | "lt" | "gte" | "lte" | "between";
  value: string | string[];
  logicalOp?: "AND" | "OR";
}

interface AdvancedFilterProps {
  availableFields: Array<{
    name: string;
    label: string;
    type: "text" | "select" | "date" | "number";
    options?: Array<{ label: string; value: string }>;
  }>;
  onApplyFilter: (filters: FilterCondition[]) => void;
  onClear: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const AdvancedFilter = ({
  availableFields,
  onApplyFilter,
  onClear,
  isOpen,
  onToggle,
}: AdvancedFilterProps) => {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);

  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      {
        field: availableFields[0]?.name || "",
        operator: "equals",
        value: "",
        logicalOp: conditions.length > 0 ? "AND" : undefined,
      },
    ]);
  };

  const handleRemoveCondition = (index: number) => {
    const newConditions = conditions.filter((_, i) => i !== index);
    setConditions(newConditions);
  };

  const handleUpdateCondition = (index: number, updates: Partial<FilterCondition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  };

  const handleApply = () => {
    onApplyFilter(conditions.filter((c) => c.value));
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
      >
        Advanced Filter
      </button>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Advanced Filters</CardTitle>
          <button
            onClick={onToggle}
            className="text-gray-500 hover:text-gray-700 text-xl font-bold"
          >
            ✕
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {conditions.length === 0 ? (
          <p className="text-gray-500 text-sm">No filters applied. Add one to get started.</p>
        ) : (
          conditions.map((condition, index) => (
            <div key={index} className="flex items-end gap-3 p-4 bg-gray-50 rounded-lg">
              {index > 0 && (
                <div className="flex items-center">
                  <select
                    value={condition.logicalOp || "AND"}
                    onChange={(e) =>
                      handleUpdateCondition(index, { logicalOp: e.target.value as "AND" | "OR" })
                    }
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                </div>
              )}

              <select
                value={condition.field}
                onChange={(e) => handleUpdateCondition(index, { field: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {availableFields.map((field) => (
                  <option key={field.name} value={field.name}>
                    {field.label}
                  </option>
                ))}
              </select>

              <select
                value={condition.operator}
                onChange={(e) =>
                  handleUpdateCondition(index, {
                    operator: e.target.value as FilterCondition["operator"],
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="equals">Equals</option>
                <option value="contains">Contains</option>
                <option value="gt">Greater than</option>
                <option value="lt">Less than</option>
                <option value="gte">Greater or equal</option>
                <option value="lte">Less or equal</option>
                <option value="between">Between</option>
              </select>

              <input
                type="text"
                value={Array.isArray(condition.value) ? "" : condition.value}
                onChange={(e) => handleUpdateCondition(index, { value: e.target.value })}
                placeholder="Enter value"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />

              <button
                onClick={() => handleRemoveCondition(index)}
                className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium"
              >
                Remove
              </button>
            </div>
          ))
        )}

        <div className="flex gap-3">
          <button
            onClick={handleAddCondition}
            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium"
          >
            + Add Filter
          </button>

          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Apply Filters
          </button>

          <button
            onClick={() => {
              setConditions([]);
              onClear();
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
          >
            Clear All
          </button>

          <button
            onClick={onToggle}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </CardContent>
    </Card>
  );
};
