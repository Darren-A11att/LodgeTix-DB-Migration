import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

interface ComparisonData {
  original: any
  migrated: any
  mapping: {
    field: string
    originalPath: string
    migratedPath: string
    transformation?: string
  }[]
}

export default function CompareRecord() {
  const router = useRouter()
  const { type, id } = router.query
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'side-by-side' | 'mapping'>('side-by-side')

  useEffect(() => {
    if (type && id) {
      fetchComparisonData()
    }
  }, [type, id])

  const fetchComparisonData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/migration/compare?type=${type}&id=${id}`)
      const data = await response.json()
      setData(data)
    } catch (error) {
      console.error('Error fetching comparison data:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderValue = (value: any): string => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'object') {
      if (value.$numberDecimal) return value.$numberDecimal
      if (value.$date) return new Date(value.$date).toLocaleString()
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) return null
      if (key.includes('[') && key.includes(']')) {
        const [arrayKey, index] = key.split('[')
        const idx = parseInt(index.replace(']', ''))
        return current[arrayKey]?.[idx]
      }
      return current[key]
    }, obj)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Record not found</h2>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            Back to list
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to list
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">
            Compare {type} - {id}
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b px-6 py-4">
            <div className="flex space-x-4">
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`px-4 py-2 rounded ${
                  viewMode === 'side-by-side'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Side by Side
              </button>
              <button
                onClick={() => setViewMode('mapping')}
                className={`px-4 py-2 rounded ${
                  viewMode === 'mapping'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Field Mapping
              </button>
            </div>
          </div>

          <div className="p-6">
            {viewMode === 'side-by-side' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-700">Original Record</h3>
                  <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96 text-sm">
                    {JSON.stringify(data.original, null, 2)}
                  </pre>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-700">Migrated Record</h3>
                  <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96 text-sm">
                    {JSON.stringify(data.migrated, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Field
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Original Value
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Migrated Value
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Transformation
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.mapping.map((map, index) => {
                      const originalValue = getNestedValue(data.original, map.originalPath)
                      const migratedValue = getNestedValue(data.migrated, map.migratedPath)
                      const valuesMatch = JSON.stringify(originalValue) === JSON.stringify(migratedValue)

                      return (
                        <tr key={index} className={!valuesMatch ? 'bg-yellow-50' : ''}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {map.field}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            <code className="bg-gray-100 px-1 rounded">
                              {renderValue(originalValue)}
                            </code>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            <code className="bg-gray-100 px-1 rounded">
                              {renderValue(migratedValue)}
                            </code>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {map.transformation || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}