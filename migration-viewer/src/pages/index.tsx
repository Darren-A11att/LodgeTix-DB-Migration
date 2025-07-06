import { useState, useEffect } from 'react'
import Link from 'next/link'

interface MigrationStats {
  catalogObjects: number
  orders: number
  contacts: number
  jurisdictions: number
  organisations: number
  financialTransactions: number
  tickets: number
}

interface RecordSummary {
  _id: string
  type: string
  name?: string
  orderNumber?: string
  email?: string
  originalId?: string
  status?: string
  migratedAt?: string
}

export default function Home() {
  const [stats, setStats] = useState<MigrationStats | null>(null)
  const [records, setRecords] = useState<RecordSummary[]>([])
  const [selectedType, setSelectedType] = useState<string>('orders')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    if (selectedType) {
      fetchRecords(selectedType)
    }
  }, [selectedType])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/migration/stats')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchRecords = async (type: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/migration/records?type=${type}`)
      const data = await response.json()
      // Ensure data is an array
      if (Array.isArray(data)) {
        setRecords(data)
      } else if (data && Array.isArray(data.records)) {
        // Handle case where data might be wrapped in an object
        setRecords(data.records)
      } else {
        console.error('Invalid data format:', data)
        setRecords([])
      }
    } catch (error) {
      console.error('Error fetching records:', error)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  const recordTypes = [
    { value: 'orders', label: 'Orders', count: stats?.orders },
    { value: 'catalog-objects', label: 'Catalog Objects', count: stats?.catalogObjects },
    { value: 'contacts', label: 'Contacts', count: stats?.contacts },
    { value: 'jurisdictions', label: 'Jurisdictions', count: stats?.jurisdictions },
    { value: 'organisations', label: 'Organisations', count: stats?.organisations },
    { value: 'tickets', label: 'Tickets', count: stats?.tickets }
  ]

  const getDisplayValue = (record: RecordSummary) => {
    switch (selectedType) {
      case 'orders':
        return record.orderNumber || record._id
      case 'catalog-objects':
        return record.name || record._id
      case 'contacts':
        return record.name || record.email || record._id
      case 'jurisdictions':
      case 'organisations':
        return record.name || record._id
      case 'tickets':
        return record.originalId || record._id
      default:
        return record._id
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Migration Viewer</h1>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {recordTypes.map(type => (
              <div
                key={type.value}
                className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
                  selectedType === type.value ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedType(type.value)}
              >
                <h3 className="text-sm font-semibold text-gray-600">{type.label}</h3>
                <p className="text-2xl font-bold text-gray-800">{type.count || 0}</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="border-b px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-800">
              {recordTypes.find(t => t.value === selectedType)?.label || 'Records'}
            </h2>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Display Value
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Array.isArray(records) && records.map(record => (
                      <tr key={record._id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {record._id}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {getDisplayValue(record)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {record.status || 'migrated'}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <Link
                            href={`/compare/${selectedType}/${record._id}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            View Comparison
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!Array.isArray(records) || records.length === 0) && (
                  <p className="text-center py-8 text-gray-500">No records found</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}