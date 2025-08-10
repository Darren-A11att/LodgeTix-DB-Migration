'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FunctionData {
  name: string;
  handle: string;
  description: string;
  locationId: string;
  locationName: string;
  startDate: string;
  endDate: string;
  organizationId: string;
  organizationName: string;
  organizationData?: {
    legalEntityName: string;
    businessNumber: string;
    address: string;
    website: string;
  };
}

interface EventData {
  id: string;
  name: string;
  date: string;
  time: string;
  description: string;
  maxAttendees: number;
}

interface TicketData {
  id: string;
  eventId: string;
  name: string;
  price: number;
  quantity: number;
  description: string;
  earlyBird: boolean;
  earlyBirdPrice?: number;
  earlyBirdEndDate?: string;
}

interface PackageData {
  id: string;
  name: string;
  tickets: Array<{ eventId: string; ticketId: string; quantity: number }>;
  price: number;
  savings: number;
  description: string;
}

export default function SetupWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form data
  const [functionData, setFunctionData] = useState<FunctionData>({
    name: '',
    handle: '',
    description: '',
    venue: '',
    startDate: '',
    endDate: '',
    organizer: '',
    organizerEmail: ''
  });
  
  const [events, setEvents] = useState<EventData[]>([]);
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [packages, setPackages] = useState<PackageData[]>([]);

  const steps = [
    { id: 1, name: 'Function Details', description: 'Basic information about your function' },
    { id: 2, name: 'Events', description: 'Add events to your function' },
    { id: 3, name: 'Tickets', description: 'Configure ticket types for each event' },
    { id: 4, name: 'Packages', description: 'Create bundled ticket packages (optional)' },
    { id: 5, name: 'Review', description: 'Review and submit' }
  ];

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const generateHandle = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const addEvent = () => {
    const newEvent: EventData = {
      id: `event_${Date.now()}`,
      name: '',
      date: functionData.startDate || '',
      time: '19:00',
      description: '',
      maxAttendees: 100
    };
    setEvents([...events, newEvent]);
  };

  const updateEvent = (id: string, field: keyof EventData, value: any) => {
    setEvents(events.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const removeEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
    setTickets(tickets.filter(t => t.eventId !== id));
  };

  const addTicket = (eventId: string) => {
    const newTicket: TicketData = {
      id: `ticket_${Date.now()}`,
      eventId,
      name: 'Standard Ticket',
      price: 0,
      quantity: 100,
      description: '',
      earlyBird: false
    };
    setTickets([...tickets, newTicket]);
  };

  const updateTicket = (id: string, field: keyof TicketData, value: any) => {
    setTickets(tickets.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTicket = (id: string) => {
    setTickets(tickets.filter(t => t.id !== id));
  };

  const addPackage = () => {
    const newPackage: PackageData = {
      id: `package_${Date.now()}`,
      name: '',
      tickets: [],
      price: 0,
      savings: 0,
      description: ''
    };
    setPackages([...packages, newPackage]);
  };

  const updatePackage = (id: string, field: keyof PackageData, value: any) => {
    setPackages(packages.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removePackage = (id: string) => {
    setPackages(packages.filter(p => p.id !== id));
  };

  const calculatePackageSavings = (pkg: PackageData) => {
    let totalPrice = 0;
    pkg.tickets.forEach(item => {
      const ticket = tickets.find(t => t.id === item.ticketId);
      if (ticket) {
        totalPrice += ticket.price * item.quantity;
      }
    });
    return totalPrice - pkg.price;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      const wizardData = {
        function: functionData,
        events,
        tickets,
        packages
      };

      const response = await fetch('/api/admin/setup-wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wizardData)
      });

      if (!response.ok) {
        throw new Error('Failed to create function setup');
      }

      const result = await response.json();
      
      // Show success message
      alert(`Successfully created function "${functionData.name}" with ${events.length} events and ${tickets.length} ticket types!`);
      
      // Redirect to products page
      router.push('/admin/products');
    } catch (error) {
      console.error('Error submitting wizard:', error);
      alert('Failed to create function setup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Function Setup Wizard</h1>
      <p className="text-gray-600 mb-8">Follow the steps to create a complete function with events and tickets</p>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  currentStep > step.id 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : currentStep === step.id 
                    ? 'bg-blue-500 border-blue-500 text-white' 
                    : 'bg-white border-gray-300 text-gray-500'
                }`}>
                  {currentStep > step.id ? '✓' : step.id}
                </div>
                <div className="mt-2 text-center">
                  <div className={`text-sm font-medium ${currentStep === step.id ? 'text-blue-600' : 'text-gray-500'}`}>
                    {step.name}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 hidden sm:block">{step.description}</div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 ${currentStep > step.id ? 'bg-green-500' : 'bg-gray-300'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow p-6 mb-6 min-h-[400px]">
        {/* Step 1: Function Details */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Function Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Function Name *</label>
                <input
                  type="text"
                  value={functionData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFunctionData({
                      ...functionData,
                      name,
                      handle: generateHandle(name)
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Annual Ball 2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Handle (URL-friendly name)</label>
                <input
                  type="text"
                  value={functionData.handle}
                  onChange={(e) => setFunctionData({ ...functionData, handle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., annual-ball-2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={functionData.description}
                  onChange={(e) => setFunctionData({ ...functionData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Describe your function..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={functionData.startDate}
                    onChange={(e) => setFunctionData({ ...functionData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={functionData.endDate}
                    onChange={(e) => setFunctionData({ ...functionData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                <input
                  type="text"
                  value={functionData.venue}
                  onChange={(e) => setFunctionData({ ...functionData, venue: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Grand Hotel Ballroom"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organizer</label>
                  <input
                    type="text"
                    value={functionData.organizer}
                    onChange={(e) => setFunctionData({ ...functionData, organizer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Organization name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organizer Email</label>
                  <input
                    type="email"
                    value={functionData.organizerEmail}
                    onChange={(e) => setFunctionData({ ...functionData, organizerEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="contact@example.com"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Events */}
        {currentStep === 2 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Events</h2>
              <button
                onClick={addEvent}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                + Add Event
              </button>
            </div>

            {events.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No events added yet. Click "Add Event" to create one.
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event, index) => (
                  <div key={event.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-medium">Event {index + 1}</h3>
                      <button
                        onClick={() => removeEvent(event.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Event Name</label>
                        <input
                          type="text"
                          value={event.name}
                          onChange={(e) => updateEvent(event.id, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., Gala Dinner"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Max Attendees</label>
                        <input
                          type="number"
                          value={event.maxAttendees}
                          onChange={(e) => updateEvent(event.id, 'maxAttendees', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Date</label>
                        <input
                          type="date"
                          value={event.date}
                          onChange={(e) => updateEvent(event.id, 'date', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Time</label>
                        <input
                          type="time"
                          value={event.time}
                          onChange={(e) => updateEvent(event.id, 'time', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-sm text-gray-600 mb-1">Description</label>
                        <textarea
                          value={event.description}
                          onChange={(e) => updateEvent(event.id, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          rows={2}
                          placeholder="Event details..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Tickets */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Ticket Types</h2>
            
            {events.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Please add events first before configuring tickets.
              </div>
            ) : (
              <div className="space-y-6">
                {events.map((event) => (
                  <div key={event.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-medium text-lg">{event.name || 'Unnamed Event'}</h3>
                      <button
                        onClick={() => addTicket(event.id)}
                        className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                      >
                        + Add Ticket Type
                      </button>
                    </div>
                    
                    {tickets.filter(t => t.eventId === event.id).length === 0 ? (
                      <div className="text-center py-4 text-gray-400 text-sm">
                        No tickets configured for this event
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tickets.filter(t => t.eventId === event.id).map((ticket) => (
                          <div key={ticket.id} className="bg-gray-50 rounded p-3">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-sm font-medium">Ticket Type</span>
                              <button
                                onClick={() => removeTicket(ticket.id)}
                                className="text-red-500 hover:text-red-700 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Name</label>
                                <input
                                  type="text"
                                  value={ticket.name}
                                  onChange={(e) => updateTicket(ticket.id, 'name', e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="e.g., VIP"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Price (ZAR)</label>
                                <input
                                  type="number"
                                  value={ticket.price}
                                  onChange={(e) => updateTicket(ticket.id, 'price', parseFloat(e.target.value))}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                                <input
                                  type="number"
                                  value={ticket.quantity}
                                  onChange={(e) => updateTicket(ticket.id, 'quantity', parseInt(e.target.value))}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                              
                              <div className="col-span-3">
                                <label className="block text-xs text-gray-600 mb-1">Description</label>
                                <input
                                  type="text"
                                  value={ticket.description}
                                  onChange={(e) => updateTicket(ticket.id, 'description', e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="What's included..."
                                />
                              </div>
                              
                              <div className="col-span-3">
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={ticket.earlyBird}
                                    onChange={(e) => updateTicket(ticket.id, 'earlyBird', e.target.checked)}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">Enable Early Bird Pricing</span>
                                </label>
                                
                                {ticket.earlyBird && (
                                  <div className="grid grid-cols-2 gap-3 mt-2">
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">Early Bird Price (ZAR)</label>
                                      <input
                                        type="number"
                                        value={ticket.earlyBirdPrice || ''}
                                        onChange={(e) => updateTicket(ticket.id, 'earlyBirdPrice', parseFloat(e.target.value))}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">Early Bird End Date</label>
                                      <input
                                        type="date"
                                        value={ticket.earlyBirdEndDate || ''}
                                        onChange={(e) => updateTicket(ticket.id, 'earlyBirdEndDate', e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Packages */}
        {currentStep === 4 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Package Deals (Optional)</h2>
              <button
                onClick={addPackage}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                + Add Package
              </button>
            </div>

            {packages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No packages created. Packages allow you to offer bundled tickets at a discount.</p>
                <p className="text-sm mt-2">This step is optional.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {packages.map((pkg, index) => (
                  <div key={pkg.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-medium">Package {index + 1}</h3>
                      <button
                        onClick={() => removePackage(pkg.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Package Name</label>
                          <input
                            type="text"
                            value={pkg.name}
                            onChange={(e) => updatePackage(pkg.id, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., Couples Package"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Package Price (ZAR)</label>
                          <input
                            type="number"
                            value={pkg.price}
                            onChange={(e) => {
                              const price = parseFloat(e.target.value);
                              updatePackage(pkg.id, 'price', price);
                              updatePackage(pkg.id, 'savings', calculatePackageSavings({ ...pkg, price }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Description</label>
                        <input
                          type="text"
                          value={pkg.description}
                          onChange={(e) => updatePackage(pkg.id, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Package details..."
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Select Tickets for Package</label>
                        <div className="border rounded p-3 space-y-2 max-h-40 overflow-y-auto">
                          {events.map(event => (
                            <div key={event.id}>
                              <div className="font-medium text-sm">{event.name}</div>
                              {tickets.filter(t => t.eventId === event.id).map(ticket => {
                                const pkgTicket = pkg.tickets.find(pt => pt.ticketId === ticket.id);
                                return (
                                  <label key={ticket.id} className="flex items-center ml-4 mt-1">
                                    <input
                                      type="checkbox"
                                      checked={!!pkgTicket}
                                      onChange={(e) => {
                                        let newTickets = [...pkg.tickets];
                                        if (e.target.checked) {
                                          newTickets.push({ eventId: event.id, ticketId: ticket.id, quantity: 2 });
                                        } else {
                                          newTickets = newTickets.filter(t => t.ticketId !== ticket.id);
                                        }
                                        updatePackage(pkg.id, 'tickets', newTickets);
                                      }}
                                      className="mr-2"
                                    />
                                    <span className="text-sm">{ticket.name} - R{ticket.price}</span>
                                    {pkgTicket && (
                                      <input
                                        type="number"
                                        value={pkgTicket.quantity}
                                        onChange={(e) => {
                                          const newTickets = pkg.tickets.map(t =>
                                            t.ticketId === ticket.id
                                              ? { ...t, quantity: parseInt(e.target.value) }
                                              : t
                                          );
                                          updatePackage(pkg.id, 'tickets', newTickets);
                                        }}
                                        className="ml-2 w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                        min="1"
                                      />
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {pkg.savings > 0 && (
                        <div className="text-green-600 text-sm">
                          Customers save R{pkg.savings.toFixed(2)} with this package!
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Review Your Setup</h2>
            
            <div className="space-y-6">
              {/* Function Summary */}
              <div>
                <h3 className="font-medium text-lg mb-2">Function Details</h3>
                <div className="bg-gray-50 rounded p-4 space-y-2">
                  <div><span className="font-medium">Name:</span> {functionData.name}</div>
                  <div><span className="font-medium">Venue:</span> {functionData.venue}</div>
                  <div><span className="font-medium">Dates:</span> {functionData.startDate} to {functionData.endDate}</div>
                  <div><span className="font-medium">Organizer:</span> {functionData.organizer}</div>
                </div>
              </div>

              {/* Events Summary */}
              <div>
                <h3 className="font-medium text-lg mb-2">Events ({events.length})</h3>
                <div className="space-y-2">
                  {events.map((event, index) => (
                    <div key={event.id} className="bg-gray-50 rounded p-3">
                      <div className="font-medium">{index + 1}. {event.name}</div>
                      <div className="text-sm text-gray-600">
                        {event.date} at {event.time} • Max {event.maxAttendees} attendees
                      </div>
                      <div className="text-sm mt-1">
                        {tickets.filter(t => t.eventId === event.id).length} ticket types configured
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tickets Summary */}
              <div>
                <h3 className="font-medium text-lg mb-2">Ticket Types ({tickets.length})</h3>
                <div className="grid grid-cols-2 gap-2">
                  {tickets.map((ticket) => {
                    const event = events.find(e => e.id === ticket.eventId);
                    return (
                      <div key={ticket.id} className="bg-gray-50 rounded p-3 text-sm">
                        <div className="font-medium">{ticket.name}</div>
                        <div className="text-gray-600">{event?.name}</div>
                        <div>R{ticket.price} • {ticket.quantity} available</div>
                        {ticket.earlyBird && (
                          <div className="text-green-600">Early bird: R{ticket.earlyBirdPrice}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Packages Summary */}
              {packages.length > 0 && (
                <div>
                  <h3 className="font-medium text-lg mb-2">Packages ({packages.length})</h3>
                  <div className="space-y-2">
                    {packages.map((pkg) => (
                      <div key={pkg.id} className="bg-gray-50 rounded p-3">
                        <div className="font-medium">{pkg.name}</div>
                        <div className="text-sm text-gray-600">
                          R{pkg.price} • Includes {pkg.tickets.length} ticket types
                        </div>
                        {pkg.savings > 0 && (
                          <div className="text-sm text-green-600">Saves R{pkg.savings.toFixed(2)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* What Will Be Created */}
              <div className="border-t pt-4">
                <h3 className="font-medium text-lg mb-2">What Will Be Created:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  <li>1 Product Collection (for the function)</li>
                  <li>{events.length} Products (one for each event)</li>
                  <li>{tickets.length} Product Variants (ticket types)</li>
                  {packages.length > 0 && <li>{packages.length} Bundle Products (packages)</li>}
                  <li>Inventory records for all tickets</li>
                  <li>Stock location for the venue</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          onClick={handleBack}
          disabled={currentStep === 1}
          className={`px-6 py-2 rounded ${
            currentStep === 1
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gray-500 text-white hover:bg-gray-600'
          }`}
        >
          Back
        </button>

        {currentStep < steps.length ? (
          <button
            onClick={handleNext}
            disabled={
              (currentStep === 1 && !functionData.name) ||
              (currentStep === 2 && events.length === 0) ||
              (currentStep === 3 && tickets.length === 0)
            }
            className={`px-6 py-2 rounded ${
              ((currentStep === 1 && !functionData.name) ||
              (currentStep === 2 && events.length === 0) ||
              (currentStep === 3 && tickets.length === 0))
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {currentStep === 4 && packages.length === 0 ? 'Skip & Continue' : 'Next'}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-6 py-2 rounded ${
              isSubmitting
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {isSubmitting ? 'Creating...' : 'Create Function Setup'}
          </button>
        )}
      </div>
    </div>
  );
}