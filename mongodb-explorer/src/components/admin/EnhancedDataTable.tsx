'use client';

import React, { useState, useEffect } from 'react';

interface BulkAction {
  label: string;
  action: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'danger' | 'secondary';
}

interface StatusFilter {
  value: string;
  label: string;
  count?: number;
  color?: string;
}

interface QuickAction {
  label: string;
  onClick: (item: any) => void;
  icon?: React.ReactNode;
}

interface EnhancedDataTableProps {
  collection: string;
  columns: Array<{
    key: string;
    label: string;
    render?: (value: any, item: any) => React.ReactNode;
  }>;
  searchFields?: string[];
  bulkActions?: BulkAction[];
  statusFilters?: StatusFilter[];
  quickActions?: QuickAction[];
  defaultStatus?: string;
  onRowClick?: (item: any) => void;
  expandedRow?: (item: any) => React.ReactNode;
}

export default function EnhancedDataTable({ 
  collection, 
  columns, 
  searchFields = [],
  bulkActions = [],
  statusFilters = [],
  quickActions = [],
  defaultStatus = 'all',
  onRowClick,
  expandedRow
}: EnhancedDataTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [activeStatus, setActiveStatus] = useState(defaultStatus);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [processingBulk, setProcessingBulk] = useState(false);

  useEffect(() => {
    fetchData();
  }, [collection, activeStatus]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeStatus && activeStatus !== 'all') {
        params.append('status', activeStatus);
      }
      
      const res = await fetch(`/api/admin/${collection}?${params}`);
      const json = await res.json();
      setData(json.data || []);
      
      // Update status counts
      if (statusFilters.length > 0) {
        fetchStatusCounts();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatusCounts = async () => {
    try {
      const res = await fetch(`/api/admin/${collection}/status-counts`);
      const counts = await res.json();
      // Update status filter counts in parent component if needed
    } catch (error) {
      console.error('Error fetching status counts:', error);
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedRows.size === 0) return;
    
    setProcessingBulk(true);
    try {
      const ids = Array.from(selectedRows);
      const res = await fetch(`/api/admin/${collection}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      });
      
      if (res.ok) {
        setSelectedRows(new Set());
        fetchData();
      }
    } catch (error) {
      console.error('Error performing bulk action:', error);
    } finally {
      setProcessingBulk(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      await fetch(`/api/admin/${collection}/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleSave = async (item: any) => {
    try {
      const method = item._id ? 'PUT' : 'POST';
      const url = item._id 
        ? `/api/admin/${collection}/${item._id}`
        : `/api/admin/${collection}`;
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      
      setEditItem(null);
      setShowCreate(false);
      fetchData();
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  const toggleRowSelection = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const selectAll = () => {
    if (selectedRows.size === filteredData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredData.map(item => item._id)));
    }
  };

  const filteredData = data.filter(item => {
    if (!search) return true;
    return searchFields.some(field => 
      String(item[field] || '').toLowerCase().includes(search.toLowerCase())
    );
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-lg text-gray-600">Loading...</div>
    </div>
  );

  return (
    <div>
      {/* Status Filters */}
      {statusFilters.length > 0 && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setActiveStatus('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeStatus === 'all' 
                ? 'bg-gray-800 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          {statusFilters.map(filter => (
            <button
              key={filter.value}
              onClick={() => setActiveStatus(filter.value)}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                activeStatus === filter.value 
                  ? 'bg-gray-800 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {filter.label}
              {filter.count !== undefined && (
                <span className="bg-white/20 px-2 py-0.5 rounded text-xs">
                  {filter.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Search and Actions Bar */}
      <div className="mb-4 flex justify-between items-center">
        <div className="flex gap-2 flex-1">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border rounded-lg flex-1 max-w-md"
          />
          {selectedRows.size > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-700">
                {selectedRows.size} selected
              </span>
              <button
                onClick={() => setSelectedRows(new Set())}
                className="text-blue-700 hover:text-blue-900 text-sm underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Add New
        </button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedRows.size > 0 && bulkActions.length > 0 && (
        <div className="mb-4 p-3 bg-gray-100 rounded-lg flex items-center justify-between">
          <div className="flex gap-2">
            {bulkActions.map(action => (
              <button
                key={action.action}
                onClick={() => handleBulkAction(action.action)}
                disabled={processingBulk}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  action.variant === 'danger' 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : action.variant === 'secondary'
                    ? 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                } disabled:opacity-50`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
          <span className="text-sm text-gray-600">
            {processingBulk ? 'Processing...' : `${selectedRows.size} items selected`}
          </span>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              {bulkActions.length > 0 && (
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                    onChange={selectAll}
                    className="rounded border-gray-300"
                  />
                </th>
              )}
              {columns.map(col => (
                <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {col.label}
                </th>
              ))}
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredData.map((item) => (
              <React.Fragment key={item._id}>
                <tr 
                  className={`${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''} ${
                    selectedRows.has(item._id) ? 'bg-blue-50' : ''
                  }`}
                >
                  {bulkActions.length > 0 && (
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(item._id)}
                        onChange={() => toggleRowSelection(item._id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                  )}
                  {columns.map(col => (
                    <td 
                      key={col.key} 
                      className="px-6 py-4 whitespace-nowrap"
                      onClick={() => onRowClick && onRowClick(item)}
                    >
                      {col.render ? col.render(item[col.key], item) : item[col.key]}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {expandedRow && (
                      <button
                        onClick={() => setExpandedRowId(expandedRowId === item._id ? null : item._id)}
                        className="text-gray-600 hover:text-gray-900 mr-4"
                      >
                        {expandedRowId === item._id ? '▼' : '▶'}
                      </button>
                    )}
                    <button
                      onClick={() => setEditItem(item)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item._id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {expandedRow && expandedRowId === item._id && (
                  <tr>
                    <td colSpan={columns.length + (bulkActions.length > 0 ? 2 : 1)} className="px-6 py-4 bg-gray-50">
                      {expandedRow(item)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredData.length} of {data.length} items
      </div>

      {/* Edit/Create Modal */}
      {(editItem || showCreate) && (
        <FormModal
          item={editItem || {}}
          columns={columns}
          onSave={handleSave}
          onClose={() => {
            setEditItem(null);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function FormModal({ item, columns, onSave, onClose }: any) {
  const [formData, setFormData] = useState(item);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {item._id ? 'Edit Item' : 'Create New Item'}
        </h2>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {columns.map((col: any) => (
            <div key={col.key}>
              <label className="block text-sm font-medium text-gray-700">
                {col.label}
              </label>
              <input
                type="text"
                value={formData[col.key] || ''}
                onChange={(e) => setFormData({ ...formData, [col.key]: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
