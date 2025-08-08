'use client';

import { useState, useEffect } from 'react';

interface DataTableProps {
  collection: string;
  columns: Array<{
    key: string;
    label: string;
    render?: (value: any, item: any) => React.ReactNode;
  }>;
  searchFields?: string[];
}

export default function DataTable({ collection, columns, searchFields = [] }: DataTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchData();
  }, [collection]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/${collection}`);
      const json = await res.json();
      setData(json.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
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

  const filteredData = data.filter(item => {
    if (!search) return true;
    return searchFields.some(field => 
      String(item[field] || '').toLowerCase().includes(search.toLowerCase())
    );
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        />
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Add New
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
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
              <tr key={item._id}>
                {columns.map(col => (
                  <td key={col.key} className="px-6 py-4 whitespace-nowrap">
                    {col.render ? col.render(item[col.key], item) : item[col.key]}
                  </td>
                ))}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
            ))}
          </tbody>
        </table>
      </div>

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