      {/* Invoice Preview Modal */}
      {showInvoicePreviewModal && editableInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[95vw] h-[90vh] flex flex-col">
            <div className="flex flex-1 overflow-hidden">
              {/* Left side - Field Mapping Controls */}
              <div className="w-[400px] border-r flex flex-col">
                <div className="p-6 pb-4 border-b">
                  <h3 className="text-lg font-semibold">Field Mapping</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  {/* Mapping Template Selector */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mapping Template</label>
                    <div className="flex gap-2">
                      <select
                        value={selectedMappingId || ''}
                        onChange={(e) => {
                          const mappingId = e.target.value || null;
                          setSelectedMappingId(mappingId);
                          
                          if (mappingId) {
                            // Get the mapping configuration
                            const mapping = fieldMappingStorage.getMapping(mappingId);
                            if (mapping) {
                              // Apply the selected mapping
                              const mappedData = fieldMappingStorage.applyMapping(
                                mappingId,
                                effectivePayment,
                                effectiveRegistration,
                                relatedDocuments
                              );
                              
                              // Update the editable invoice with mapped data
                              const updatedInvoice = {
                                ...editableInvoice,
                                ...mappedData
                              };
                              setEditableInvoice(updatedInvoice);
                              
                              // Update customer/supplier specific state based on invoice type
                              if (editableInvoice.invoiceType === 'customer') {
                                setCustomerInvoice(updatedInvoice);
                                setCustomerSelectedMappingId(mappingId);
                              } else {
                                setSupplierInvoice(updatedInvoice);
                                setSupplierSelectedMappingId(mappingId);
                              }
                              
                              // Get the full saved mapping to extract line items and array mappings
                              const savedMapping = savedMappings.find(m => m.id === mappingId);
                              if (savedMapping) {
                                // Set field mapping config including line items
                                const fullConfig = {
                                  ...savedMapping.mappings,
                                  lineItems: savedMapping.lineItems
                                };
                                setFieldMappingConfig(fullConfig);
                                
                                // Update customer/supplier specific config
                                if (editableInvoice.invoiceType === 'customer') {
                                  setCustomerFieldMappingConfig(fullConfig);
                                } else {
                                  setSupplierFieldMappingConfig(fullConfig);
                                }
                                
                                // Load array mappings
                                if (savedMapping.arrayMappings) {
                                  setArrayMappings(savedMapping.arrayMappings);
                                  if (editableInvoice.invoiceType === 'customer') {
                                    setCustomerArrayMappings(savedMapping.arrayMappings);
                                  } else {
                                    setSupplierArrayMappings(savedMapping.arrayMappings);
                                  }
                                }
                              }
                            }
                          } else {
                            // Clear the mapping configuration if no mapping selected
                            setFieldMappingConfig({});
                            setArrayMappings([]);
                            
                            if (editableInvoice.invoiceType === 'customer') {
                              setCustomerFieldMappingConfig({});
                              setCustomerArrayMappings([]);
                              setCustomerSelectedMappingId(null);
                            } else {
                              setSupplierFieldMappingConfig({});
                              setSupplierArrayMappings([]);
                              setSupplierSelectedMappingId(null);
                            }
                          }
                        }}
                        className="flex-1 text-sm px-3 py-2 border rounded"
                      >
                        <option value="">Select a mapping template...</option>
                        {savedMappings.map(mapping => (
                          <option key={mapping.id} value={mapping.id}>
                            {mapping.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setShowSaveMappingModal(true)}
                        className="px-3 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
                        title="Create new mapping template"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Create sourceDocuments object for FieldMappingSelector */}
                  {(() => {
                    const sourceDocuments = {
                      registrations: effectiveRegistration,
                      payments: effectivePayment
                    };
                    
                    return (
                  <div className="space-y-6">
                    {/* Invoice Details Section */}
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">Invoice Details</h4>
                      <FieldMappingSelector
                        fieldName="Invoice Date"
                        fieldPath="date"
                        currentValue={editableInvoice.date}
                        allOptions={extractAllFieldOptions(effectivePayment, effectiveRegistration)}
                        onMappingChange={handleFieldMappingChange}
                        fieldType="date"
                      />
                      <FieldMappingSelector
                        fieldName="Status"
                        fieldPath="status"
                        currentValue={editableInvoice.status}
                        allOptions={extractAllFieldOptions(effectivePayment, effectiveRegistration)}
                        onMappingChange={handleFieldMappingChange}
                        fieldType="select"
                        selectOptions={[
                          { value: 'paid', label: 'Paid' },
                          { value: 'pending', label: 'Pending' },
                          { value: 'overdue', label: 'Overdue' },
                          { value: 'cancelled', label: 'Cancelled' }
                        ]}
                      />
                    </div>

                    {/* Bill To Section */}
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">Bill To Information</h4>
                      <FieldMappingSelector
                        fieldName="Business Name"
                        fieldPath="billTo.businessName"
                        currentValue={editableInvoice.billTo?.businessName}
                        allOptions={extractAllFieldOptions(effectivePayment, effectiveRegistration)}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Business Number (ABN)"
                        fieldPath="billTo.businessNumber"
                        currentValue={editableInvoice.billTo?.businessNumber}
                        allOptions={extractAllFieldOptions(effectivePayment, effectiveRegistration)}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="First Name"
                        fieldPath="billTo.firstName"
                        currentValue={editableInvoice.billTo?.firstName}
                        allOptions={extractAllFieldOptions(effectivePayment, effectiveRegistration)}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Last Name"
                        fieldPath="billTo.lastName"
                        currentValue={editableInvoice.billTo?.lastName}
                        allOptions={extractAllFieldOptions(effectivePayment, effectiveRegistration)}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Email"
                        fieldPath="billTo.email"
                        currentValue={editableInvoice.billTo?.email}
                        allOptions={extractAllFieldOptions(effectivePayment, effectiveRegistration)}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Address Line 1"
                        fieldPath="billTo.addressLine1"
                        currentValue={editableInvoice.billTo?.addressLine1}
                        allOptions={extractAllFieldOptions(effectivePayment, effectiveRegistration)}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="City"
                        fieldPath="billTo.city"
                        currentValue={editableInvoice.billTo?.city}
                        allOptions={extractAllFieldOptions(effectivePayment, effectiveRegistration)}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Postal Code"
                        fieldPath="billTo.postalCode"
                        currentValue={editableInvoice.billTo?.postalCode}
                        allOptions={extractAllFieldOptions(effectivePayment, effectiveRegistration)}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="State/Province"
                        fieldPath="billTo.stateProvince"
                        currentValue={editableInvoice.billTo?.stateProvince}
                        allOptions={extractAllFieldOptions(effectivePayment, effectiveRegistration)}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Country"
                        fieldPath="billTo.country"
                        currentValue={editableInvoice.billTo?.country}
                        allOptions={extractAllFieldOptions(effectivePayment, effectiveRegistration)}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                    </div>
                  </div>
                );
                })()}
                </div>
              </div>

              {/* Center - Invoice Preview */}
              <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
                <h3 className="text-lg font-semibold mb-4">Invoice Preview</h3>
                <InvoiceComponent 
                  invoice={{
                    ...editableInvoice,
                    billTo: fieldMappings.billTo || editableInvoice.billTo || {}
                  }} 
                />
              </div>

              {/* Right side - Tools */}
              <div className="w-[350px] border-l flex flex-col">
                <div className="p-6 pb-4 border-b">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Tools</h3>
                    <button
                      onClick={() => {
                        setShowInvoicePreviewModal(false);
                        setEditableInvoice(null);
                        setFieldMappings({});
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  <LineItemManager
                    items={editableInvoice.items || []}
                    onItemsChange={(items) => {
                      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                      setEditableInvoice({
                        ...editableInvoice,
                        items,
                        subtotal,
                        total: subtotal + (editableInvoice.processingFees || 0)
                      });
                    }}
                    registrationData={effectiveRegistration}
                  />
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-6 pt-4 border-t bg-gray-50">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Apply the mapped invoice for creation (one-off)
                    setCurrentMatch({
                      ...currentMatch!,
                      invoice: editableInvoice
                    });
                    setShowInvoicePreviewModal(false);
                  }}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Save One Off
                </button>
                <button
                  onClick={() => {
                    setShowSaveMappingModal(true);
                  }}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Save & Update Map
                </button>
                <button
                  onClick={() => {
                    setShowInvoicePreviewModal(false);
                    setEditableInvoice(null);
                    setFieldMappings({});
                  }}
                  className="flex-1 border px-4 py-2 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}