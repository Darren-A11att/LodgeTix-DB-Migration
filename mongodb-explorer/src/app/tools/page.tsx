'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/BackButton';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  category: 'sync' | 'import' | 'validation' | 'utility' | 'reporting';
  status?: 'active' | 'beta' | 'coming-soon';
}

interface ToolCategory {
  name: string;
  description: string;
  tools: Tool[];
}

export default function ToolsDashboard() {
  const router = useRouter();

  const toolCategories: ToolCategory[] = [
    {
      name: 'Payment Processing Tools',
      description: 'Tools for managing payment reconciliation and imports',
      tools: [
        {
          id: 'review-matches',
          name: 'Review Payment Matches',
          description: 'Manually review and approve payment-registration matches before import',
          icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>,
          href: '/tools/review-matches',
          category: 'validation',
          status: 'active'
        },
        {
          id: 'pending-imports',
          name: 'Process Pending Imports',
          description: 'Review and process registrations waiting for payment verification',
          icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>,
          href: '/tools/pending-imports',
          category: 'validation',
          status: 'active'
        },
        {
          id: 'sync-orchestration',
          name: 'Data Sync Orchestration',
          description: 'Automated workflow for syncing payments and registrations with validation',
          icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>,
          href: '/tools/sync-orchestration',
          category: 'sync',
          status: 'active'
        }
      ]
    }
  ];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'sync': return 'bg-blue-500';
      case 'import': return 'bg-green-500';
      case 'validation': return 'bg-purple-500';
      case 'utility': return 'bg-orange-500';
      case 'reporting': return 'bg-indigo-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return null;
      case 'beta':
        return <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Beta</span>;
      case 'coming-soon':
        return <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Coming Soon</span>;
      default:
        return null;
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Tools Dashboard</h1>
            <p className="text-gray-600 mt-1">Interactive tools for managing payments, registrations, and data quality</p>
          </div>
        </div>
        <SimpleDatabaseSelector className="w-64" />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Tools</p>
              <p className="text-2xl font-bold text-gray-900">3</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tool Category</p>
              <p className="text-2xl font-bold text-gray-900">Payment Processing</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              <p className="text-2xl font-bold text-gray-900">All Operational</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tool Categories */}
      {toolCategories.map((category, categoryIndex) => (
        <div key={categoryIndex} className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">{category.name}</h2>
          <p className="text-gray-600 mb-6">{category.description}</p>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {category.tools.map((tool) => (
              <Link
                key={tool.id}
                href={tool.href}
                className={`group bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden ${
                  tool.status === 'coming-soon' ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg ${getCategoryColor(tool.category)} bg-opacity-10`}>
                      <div className={`${getCategoryColor(tool.category).replace('bg-', 'text-')}`}>
                        {tool.icon}
                      </div>
                    </div>
                    {getStatusBadge(tool.status)}
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                    {tool.name}
                  </h3>
                  
                  <p className="text-gray-600 text-sm mb-4">
                    {tool.description}
                  </p>
                  
                  <div className="flex items-center text-sm text-blue-600 group-hover:text-blue-700">
                    <span>Open Tool</span>
                    <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* Getting Started */}
      <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Getting Started</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Step 1: Review Payment Matches</h3>
              <p className="text-gray-600">Start by reviewing and approving payment-registration matches to ensure data accuracy.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Step 2: Process Pending Imports</h3>
              <p className="text-gray-600">Handle registrations waiting for payment verification to complete the import process.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Step 3: Run Sync Orchestration</h3>
              <p className="text-gray-600">Use the automated workflow to sync all data between systems efficiently.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}