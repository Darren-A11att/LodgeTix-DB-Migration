'use client';

import { useState, useEffect } from 'react';
import JsonViewer from './JsonViewer';
import apiService from '@/lib/api';

interface RelatedDocumentsProps {
  registrationId: string;
  onFieldSelect?: (path: string, value: any) => void;
}

export default function RelatedDocuments({ registrationId, onFieldSelect }: RelatedDocumentsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relatedDocs, setRelatedDocs] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    eventTickets: true,
    events: true,
    packages: true,
    lodges: true,
    customers: true,
    bookingContacts: true,
    functions: true
  });

  useEffect(() => {
    if (registrationId) {
      fetchRelatedDocuments();
    }
  }, [registrationId]);

  const fetchRelatedDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getRegistrationRelatedDocuments(registrationId);
      setRelatedDocs(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch related documents');
      console.error('Error fetching related documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleFieldClick = (docType: string, docIndex: number, fieldPath: string, value: any) => {
    if (onFieldSelect) {
      const fullPath = `relatedDocuments.${docType}[${docIndex}].${fieldPath}`;
      onFieldSelect(fullPath, value);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-600">
        Loading related documents...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-600 mb-2">Error: {error}</div>
        <button
          onClick={fetchRelatedDocuments}
          className="text-sm text-blue-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!relatedDocs) {
    return null;
  }

  const { relatedDocuments, summary } = relatedDocs;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-blue-50 p-3 rounded">
        <h4 className="font-semibold text-blue-900 mb-1">Related Documents Summary</h4>
        <div className="text-sm text-blue-700 grid grid-cols-2 gap-2">
          <div>Ticket IDs found: {summary.ticketIds.length}</div>
          <div>Event Tickets: {summary.eventTicketsFound}</div>
          <div>Events: {summary.eventsFound}</div>
          <div>Packages: {summary.packagesFound}</div>
          <div>Lodges: {summary.lodgesFound}</div>
          <div>Customers: {summary.customersFound}</div>
          <div>Booking Contacts: {summary.bookingContactsFound}</div>
          <div>Functions: {summary.functionsFound}</div>
        </div>
      </div>

      {/* Event Tickets */}
      {relatedDocuments.eventTickets.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('eventTickets')}
            className="w-full bg-gray-100 px-4 py-2 flex justify-between items-center hover:bg-gray-200"
          >
            <h4 className="font-semibold">Event Tickets ({relatedDocuments.eventTickets.length})</h4>
            <svg
              className={`w-5 h-5 transform transition-transform ${expandedSections.eventTickets ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSections.eventTickets && (
            <div className="p-4 space-y-4">
              {relatedDocuments.eventTickets.map((ticket: any, index: number) => (
                <div key={index} className="border rounded">
                  <div className="bg-gray-50 px-3 py-2">
                    <h5 className="font-medium text-sm">
                      {ticket.name || ticket.ticketName || `Ticket ${index + 1}`}
                    </h5>
                    {ticket.price && (
                      <span className="text-sm text-gray-600 ml-2">
                        Price: ${ticket.price.$numberDecimal || ticket.price}
                      </span>
                    )}
                  </div>
                  <div 
                    className="cursor-pointer"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.dataset.fieldPath) {
                        handleFieldClick('eventTickets', index, target.dataset.fieldPath, target.dataset.fieldValue);
                      }
                    }}
                  >
                    <JsonViewer 
                      data={ticket} 
                      maxHeight="max-h-64"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Events */}
      {relatedDocuments.events.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('events')}
            className="w-full bg-gray-100 px-4 py-2 flex justify-between items-center hover:bg-gray-200"
          >
            <h4 className="font-semibold">Events ({relatedDocuments.events.length})</h4>
            <svg
              className={`w-5 h-5 transform transition-transform ${expandedSections.events ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSections.events && (
            <div className="p-4 space-y-4">
              {relatedDocuments.events.map((event: any, index: number) => (
                <div key={index} className="border rounded">
                  <div className="bg-gray-50 px-3 py-2">
                    <h5 className="font-medium text-sm">
                      {event.name || event.eventName || `Event ${index + 1}`}
                    </h5>
                    {event.startDate && (
                      <span className="text-sm text-gray-600 ml-2">
                        {new Date(event.startDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div 
                    className="cursor-pointer"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.dataset.fieldPath) {
                        handleFieldClick('events', index, target.dataset.fieldPath, target.dataset.fieldValue);
                      }
                    }}
                  >
                    <JsonViewer 
                      data={event} 
                      maxHeight="max-h-64"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Packages */}
      {relatedDocuments.packages.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('packages')}
            className="w-full bg-gray-100 px-4 py-2 flex justify-between items-center hover:bg-gray-200"
          >
            <h4 className="font-semibold">Packages ({relatedDocuments.packages.length})</h4>
            <svg
              className={`w-5 h-5 transform transition-transform ${expandedSections.packages ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSections.packages && (
            <div className="p-4 space-y-4">
              {relatedDocuments.packages.map((pkg: any, index: number) => (
                <div key={index} className="border rounded">
                  <div className="bg-gray-50 px-3 py-2">
                    <h5 className="font-medium text-sm">
                      {pkg.name || pkg.packageName || `Package ${index + 1}`}
                    </h5>
                    {pkg.lodgeId && (
                      <span className="text-sm text-gray-600 ml-2">
                        Lodge ID: {pkg.lodgeId}
                      </span>
                    )}
                  </div>
                  <div 
                    className="cursor-pointer"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.dataset.fieldPath) {
                        handleFieldClick('packages', index, target.dataset.fieldPath, target.dataset.fieldValue);
                      }
                    }}
                  >
                    <JsonViewer 
                      data={pkg} 
                      maxHeight="max-h-64"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lodges */}
      {relatedDocuments.lodges.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('lodges')}
            className="w-full bg-gray-100 px-4 py-2 flex justify-between items-center hover:bg-gray-200"
          >
            <h4 className="font-semibold">Lodges ({relatedDocuments.lodges.length})</h4>
            <svg
              className={`w-5 h-5 transform transition-transform ${expandedSections.lodges ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSections.lodges && (
            <div className="p-4 space-y-4">
              {relatedDocuments.lodges.map((lodge: any, index: number) => (
                <div key={index} className="border rounded">
                  <div className="bg-gray-50 px-3 py-2">
                    <h5 className="font-medium text-sm">
                      {lodge.name || lodge.lodgeName || `Lodge ${index + 1}`}
                    </h5>
                    {lodge.address && (
                      <span className="text-sm text-gray-600 ml-2">
                        {lodge.address.city || lodge.address}
                      </span>
                    )}
                  </div>
                  <div 
                    className="cursor-pointer"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.dataset.fieldPath) {
                        handleFieldClick('lodges', index, target.dataset.fieldPath, target.dataset.fieldValue);
                      }
                    }}
                  >
                    <JsonViewer 
                      data={lodge} 
                      maxHeight="max-h-64"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Customers */}
      {relatedDocuments.customers.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('customers')}
            className="w-full bg-gray-100 px-4 py-2 flex justify-between items-center hover:bg-gray-200"
          >
            <h4 className="font-semibold">Customers ({relatedDocuments.customers.length})</h4>
            <svg
              className={`w-5 h-5 transform transition-transform ${expandedSections.customers ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSections.customers && (
            <div className="p-4 space-y-4">
              {relatedDocuments.customers.map((customer: any, index: number) => (
                <div key={index} className="border rounded">
                  <div className="bg-gray-50 px-3 py-2">
                    <h5 className="font-medium text-sm">
                      {customer.firstName} {customer.lastName}
                    </h5>
                    {customer.email && (
                      <span className="text-sm text-gray-600 ml-2">
                        {customer.email}
                      </span>
                    )}
                  </div>
                  <div 
                    className="cursor-pointer"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.dataset.fieldPath) {
                        handleFieldClick('customers', index, target.dataset.fieldPath, target.dataset.fieldValue);
                      }
                    }}
                  >
                    <JsonViewer 
                      data={customer} 
                      maxHeight="max-h-64"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Booking Contacts */}
      {relatedDocuments.bookingContacts.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('bookingContacts')}
            className="w-full bg-gray-100 px-4 py-2 flex justify-between items-center hover:bg-gray-200"
          >
            <h4 className="font-semibold">Booking Contacts ({relatedDocuments.bookingContacts.length})</h4>
            <svg
              className={`w-5 h-5 transform transition-transform ${expandedSections.bookingContacts ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSections.bookingContacts && (
            <div className="p-4 space-y-4">
              {relatedDocuments.bookingContacts.map((contact: any, index: number) => (
                <div key={index} className="border rounded">
                  <div className="bg-gray-50 px-3 py-2">
                    <h5 className="font-medium text-sm">
                      {contact.firstName} {contact.lastName}
                    </h5>
                    {contact.email && (
                      <span className="text-sm text-gray-600 ml-2">
                        {contact.email}
                      </span>
                    )}
                  </div>
                  <div 
                    className="cursor-pointer"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.dataset.fieldPath) {
                        handleFieldClick('bookingContacts', index, target.dataset.fieldPath, target.dataset.fieldValue);
                      }
                    }}
                  >
                    <JsonViewer 
                      data={contact} 
                      maxHeight="max-h-64"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Functions */}
      {relatedDocuments.functions.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('functions')}
            className="w-full bg-gray-100 px-4 py-2 flex justify-between items-center hover:bg-gray-200"
          >
            <h4 className="font-semibold">Functions ({relatedDocuments.functions.length})</h4>
            <svg
              className={`w-5 h-5 transform transition-transform ${expandedSections.functions ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSections.functions && (
            <div className="p-4 space-y-4">
              {relatedDocuments.functions.map((func: any, index: number) => (
                <div key={index} className="border rounded">
                  <div className="bg-gray-50 px-3 py-2">
                    <h5 className="font-medium text-sm">
                      {func.name || func.functionName || `Function ${index + 1}`}
                    </h5>
                    {func.eventDate && (
                      <span className="text-sm text-gray-600 ml-2">
                        {new Date(func.eventDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div 
                    className="cursor-pointer"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.dataset.fieldPath) {
                        handleFieldClick('functions', index, target.dataset.fieldPath, target.dataset.fieldValue);
                      }
                    }}
                  >
                    <JsonViewer 
                      data={func} 
                      maxHeight="max-h-64"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No related documents found */}
      {relatedDocuments.eventTickets.length === 0 && 
       relatedDocuments.events.length === 0 &&
       relatedDocuments.packages.length === 0 &&
       relatedDocuments.lodges.length === 0 &&
       relatedDocuments.customers.length === 0 &&
       relatedDocuments.bookingContacts.length === 0 &&
       relatedDocuments.functions.length === 0 && (
        <div className="text-gray-500 text-center py-4">
          No related documents found
        </div>
      )}
    </div>
  );
}