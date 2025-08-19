'use client';

import { useState, useEffect } from 'react';
import apiService from '@/lib/api';

interface TicketEditModalProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function TicketEditModal({ ticketId, isOpen, onClose, onSave }: TicketEditModalProps) {
  const [ticketData, setTicketData] = useState<any>(null);
  const [originalData, setOriginalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && ticketId) {
      fetchTicketData();
    }
  }, [isOpen, ticketId]);

  const fetchTicketData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.get(`/tickets/${ticketId}`);
      setTicketData(data);
      setOriginalData(JSON.parse(JSON.stringify(data))); // Deep clone
    } catch (err) {
      console.error('Error fetching ticket:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldPath: string, value: any) => {
    setTicketData((prev: any) => {
      const newData = { ...prev };
      const pathParts = fieldPath.split('.');
      let current = newData;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!current[pathParts[i]]) {
          current[pathParts[i]] = {};
        }
        current = current[pathParts[i]];
      }
      
      current[pathParts[pathParts.length - 1]] = value;
      return newData;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await apiService.put(`/tickets/${ticketId}`, ticketData);
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving ticket:', err);
      setError(err instanceof Error ? err.message : 'Failed to save ticket');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTicketData(JSON.parse(JSON.stringify(originalData)));
  };

  const renderField = (key: string, value: any, path: string = '') => {
    const fieldPath = path ? `${path}.${key}` : key;
    
    if (value === null || value === undefined) {
      return (
        <div key={fieldPath} className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {key}
          </label>
          <input
            type="text"
            value=""
            onChange={(e) => handleFieldChange(fieldPath, e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      );
    }
    
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return (
        <div key={fieldPath} className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {key}
          </label>
          {typeof value === 'boolean' ? (
            <select
              value={value.toString()}
              onChange={(e) => handleFieldChange(fieldPath, e.target.value === 'true')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              type={typeof value === 'number' ? 'number' : 'text'}
              value={value}
              onChange={(e) => handleFieldChange(fieldPath, typeof value === 'number' ? Number(e.target.value) : e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      );
    }
    
    if (Array.isArray(value)) {
      return (
        <div key={fieldPath} className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {key} (Array)
          </label>
          <textarea
            value={JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleFieldChange(fieldPath, parsed);
              } catch {
                // Invalid JSON, don't update
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            rows={4}
          />
        </div>
      );
    }
    
    if (typeof value === 'object') {
      return (
        <div key={fieldPath} className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">{key}</h4>
          <div className="ml-4 p-3 bg-gray-50 rounded-md">
            {Object.entries(value).map(([subKey, subValue]) => 
              renderField(subKey, subValue, fieldPath)
            )}
          </div>
        </div>
      );
    }
    
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">
            Edit Ticket: {ticketId}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-gray-600">Loading ticket data...</div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600">Error: {error}</p>
            </div>
          ) : ticketData ? (
            <div>
              {Object.entries(ticketData).map(([key, value]) => 
                renderField(key, value)
              )}
            </div>
          ) : null}
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Close
          </button>
          <div className="space-x-3">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}