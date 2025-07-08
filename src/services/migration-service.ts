import { ObjectId } from 'mongodb';
import { 
  getDestinationDb, 
  executeMigrationTransaction 
} from '../connections/dual-mongodb';
import * as path from 'path';
import * as fs from 'fs/promises';

interface DefaultMapping {
  [fieldName: string]: string;
}

// Removed unused MigrationConfig interface

export class MigrationService {
  private defaultMappings: Map<string, DefaultMapping> = new Map();
  
  /**
   * Load default mappings from documents.json files
   */
  async loadDefaultMappings(): Promise<void> {
    const collectionsPath = path.join(process.cwd(), 'docs/database-schema/collections');
    
    try {
      const collections = await fs.readdir(collectionsPath);
      
      for (const collection of collections) {
        const documentsJsonPath = path.join(collectionsPath, collection, 'documents.json');
        
        try {
          const fileContent = await fs.readFile(documentsJsonPath, 'utf-8');
          const mapping = JSON.parse(fileContent);
          this.defaultMappings.set(collection, mapping);
          console.log(`Loaded default mapping for ${collection}`);
        } catch (error) {
          // Skip if documents.json doesn't exist
          console.log(`No documents.json found for ${collection}`);
        }
      }
    } catch (error) {
      console.error('Error loading default mappings:', error);
    }
  }
  
  /**
   * Get default mapping for a collection
   */
  getDefaultMapping(collection: string): DefaultMapping | undefined {
    return this.defaultMappings.get(collection);
  }
  
  /**
   * Apply mapping to transform source document to destination format
   */
  applyMapping(
    sourceData: any, 
    mapping: Record<string, any>,
    defaultMapping?: DefaultMapping
  ): any {
    const result: any = {};
    
    // First apply default mappings if available
    if (defaultMapping) {
      for (const [field, mappingPath] of Object.entries(defaultMapping)) {
        if (typeof mappingPath === 'string' && mappingPath.includes(':')) {
          const [, path] = mappingPath.split(':').map(s => s.trim());
          // For now, we'll handle simple mappings from the source document
          const value = this.getValueByPath(sourceData, path);
          if (value !== undefined) {
            result[field] = value;
          }
        }
      }
    }
    
    // Then apply custom mappings (overrides defaults)
    for (const [field, fieldMapping] of Object.entries(mapping)) {
      if (fieldMapping?.source) {
        const value = this.getValueByPath(sourceData, fieldMapping.source);
        if (value !== undefined) {
          result[field] = value;
        }
      } else if (fieldMapping?.customValue !== undefined) {
        // Handle special values like date markers and computations
        if (typeof fieldMapping.customValue === 'object' && fieldMapping.customValue?.$now) {
          result[field] = new Date();
        } else if (typeof fieldMapping.customValue === 'object' && fieldMapping.customValue?.$compute) {
          const computedValue = this.executeComputation(fieldMapping.customValue.$compute, sourceData);
          if (computedValue !== null) {
            result[field] = computedValue;
          }
        } else {
          result[field] = fieldMapping.customValue;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Get value from object by dot notation path
   */
  private getValueByPath(obj: any, path: string): any {
    if (!path) return undefined;
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      // Handle array notation like "items[0]"
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, fieldName, index] = arrayMatch;
        current = current[fieldName];
        if (Array.isArray(current)) {
          current = current[parseInt(index)];
        } else {
          return undefined;
        }
      } else {
        current = current[part];
      }
    }
    
    return current;
  }
  
  /**
   * Execute a computation definition
   */
  private executeComputation(computation: any, sourceData: any): any {
    if (!computation || !computation.type) return null;
    
    const getValuesFromSources = (sources: string[]): any[] => {
      const values: any[] = [];
      
      sources.forEach(source => {
        // Handle array fields (e.g., events.dates.eventStart)
        const parts = source.split('.');
        
        // Check if we're dealing with an array field
        let current = sourceData;
        let isArrayField = false;
        let arrayValues: any[] = [];
        
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          
          if (current === null || current === undefined) break;
          
          if (Array.isArray(current[part])) {
            // We've hit an array, collect values from remaining path
            isArrayField = true;
            const remainingPath = parts.slice(i + 1).join('.');
            
            current[part].forEach((item: any) => {
              if (remainingPath) {
                const value = this.getValueByPath(item, remainingPath);
                if (value !== undefined && value !== null) {
                  arrayValues.push(value);
                }
              } else {
                arrayValues.push(item);
              }
            });
            break;
          } else {
            current = current[part];
          }
        }
        
        if (isArrayField) {
          values.push(...arrayValues);
        } else {
          const value = this.getValueByPath(sourceData, source);
          if (value !== undefined && value !== null) {
            values.push(value);
          }
        }
      });
      
      return values;
    };
    
    switch (computation.type) {
      case 'minDate': {
        const dates = getValuesFromSources(computation.sources)
          .map(d => new Date(d))
          .filter(d => !isNaN(d.getTime()));
        return dates.length > 0 
          ? new Date(Math.min(...dates.map(d => d.getTime())))
          : null;
      }
      
      case 'maxDate': {
        const dates = getValuesFromSources(computation.sources)
          .map(d => new Date(d))
          .filter(d => !isNaN(d.getTime()));
        return dates.length > 0 
          ? new Date(Math.max(...dates.map(d => d.getTime())))
          : null;
      }
      
      case 'sum': {
        const numbers = getValuesFromSources(computation.sources)
          .map(n => parseFloat(n))
          .filter(n => !isNaN(n));
        return numbers.reduce((sum, n) => sum + n, 0);
      }
      
      case 'count': {
        const values = getValuesFromSources(computation.sources);
        return values.length;
      }
      
      case 'arithmetic': {
        const values = getValuesFromSources(computation.sources);
        if (values.length === 0) return 0;
        
        const firstValue = parseFloat(values[0]) || 0;
        const operand = computation.parameters?.operand || 0;
        
        switch (computation.parameters?.operator) {
          case '+': return firstValue + operand;
          case '-': return firstValue - operand;
          case '*': return firstValue * operand;
          case '/': return operand !== 0 ? firstValue / operand : 0;
          default: return firstValue;
        }
      }

      case 'expression': {
        if (!computation.parameters?.expression || computation.parameters.expression.trim() === '') {
          return 0;
        }
        
        // Replace field references with actual values
        let expression = computation.parameters.expression;
        const fieldPattern = /\{([^}]+)\}/g;
        const matches = expression.match(fieldPattern);
        
        if (matches) {
          matches.forEach((match: string) => {
            const fieldPath = match.slice(1, -1); // Remove { and }
            let value = this.getValueByPath(sourceData, fieldPath);
            
            // Handle MongoDB $numberDecimal format
            if (value && typeof value === 'object' && '$numberDecimal' in value) {
              value = value.$numberDecimal;
            }
            
            const numValue = parseFloat(value) || 0;
            expression = expression.replace(match, numValue.toString());
          });
        }
        
        // Check if the expression is valid after replacements
        expression = expression.trim();
        
        // Remove trailing operators
        expression = expression.replace(/[\+\-\*\/]\s*$/, '').trim();
        
        if (!expression || expression === '') {
          return 0;
        }
        
        // Check for incomplete expressions (e.g., "5 + " or "10 - ")
        if (/[\+\-\*\/]\s*$/.test(expression)) {
          return 0;
        }
        
        try {
          // Safely evaluate the mathematical expression
          // This uses Function constructor which is safer than eval
          const result = new Function('return ' + expression)();
          return isNaN(result) ? 0 : result;
        } catch (error) {
          console.error('Error evaluating expression:', expression, error);
          return 0;
        }
      }
      
      case 'concat': {
        const values = getValuesFromSources(computation.sources);
        return values.join(computation.parameters?.separator || ' ');
      }
      
      case 'now': {
        return new Date();
      }
      
      // Note: Lookup operations would require async and access to destination DB
      // For now, we'll return a placeholder
      case 'lookup': {
        console.warn('Lookup operations not yet supported in migration service');
        return null;
      }
      
      default:
        console.warn(`Unknown computation type: ${computation.type}`);
        return null;
    }
  }
  
  /**
   * Migrate a function with events (ACID transaction)
   */
  async migrateFunction(sourceDoc: any, mappings: Record<string, any>, relatedDocs?: Record<string, any>): Promise<any> {
    return executeMigrationTransaction(async (session) => {
      const destinationDb = getDestinationDb();
      
      // Get default mapping for functions
      const defaultMapping = this.getDefaultMapping('functions');
      
      // Transform the document
      const functionDoc = this.applyMapping(sourceDoc, mappings.functions || {}, defaultMapping);
      
      // Ensure required fields
      if (!functionDoc.functionId) {
        functionDoc.functionId = sourceDoc.functionId || `func-${new ObjectId().toHexString()}`;
      }
      
      // Add metadata
      functionDoc.metadata = {
        ...functionDoc.metadata,
        migrated: true,
        migratedAt: new Date(),
        sourceId: sourceDoc._id
      };
      
      // Insert the function
      const result = await destinationDb
        .collection('functions')
        .insertOne(functionDoc, { session });
      
      // If there are related products to create
      // Use related events if provided, otherwise fall back to sourceDoc.events
      const eventsToProcess = relatedDocs?.events || sourceDoc.events || [];
      
      if (mappings.products && Array.isArray(eventsToProcess)) {
        const products = [];
        
        for (const event of eventsToProcess) {
          // Create ticket products for each event
          const productMapping = mappings.products;
          const product = this.applyMapping(event, productMapping, this.getDefaultMapping('products'));
          
          // Ensure required fields for product
          product.productId = product.productId || `prod-${new ObjectId().toHexString()}`;
          product.functionId = functionDoc.functionId;
          product.type = 'ticket';
          product.status = 'active';
          
          // Set inventory based on capacity
          if (!product.inventory) {
            product.inventory = {
              method: 'allocated',
              totalCapacity: event.capacity || 100,
              soldCount: 0,
              reservedCount: 0,
              availableCount: event.capacity || 100,
              lastUpdated: new Date(),
              version: 1
            };
          }
          
          products.push(product);
        }
        
        if (products.length > 0) {
          await destinationDb
            .collection('products')
            .insertMany(products, { session });
        }
      }
      
      return result;
    });
  }
  
  /**
   * Migrate a registration with tickets (ACID transaction)
   */
  async migrateRegistration(
    sourceDoc: any, 
    relatedDocs: Record<string, any>,
    mappings: Record<string, any>
  ): Promise<any> {
    return executeMigrationTransaction(async (session) => {
      const destinationDb = getDestinationDb();
      
      // Transform registration
      const registrationDoc = this.applyMapping(
        sourceDoc, 
        mappings.registrations || {}, 
        this.getDefaultMapping('registrations')
      );
      
      // Extract event_ticket_ids from the registration
      const eventTicketIds = this.extractEventTicketIds(sourceDoc);
      
      // If we have event_ticket_ids and related event_tickets, process them
      if (eventTicketIds.length > 0 && relatedDocs.event_tickets) {
        // Create line items from event tickets
        registrationDoc.lineItems = eventTicketIds.map((ticketId: string) => {
          const eventTicket = relatedDocs.event_tickets.find(
            (ticket: any) => ticket.eventTicketId === ticketId || 
                           ticket.event_ticket_id === ticketId
          );
          
          if (eventTicket) {
            return {
              productId: eventTicket.eventId || eventTicket.event_id,
              productName: eventTicket.name || 'Event Ticket',
              variationId: ticketId,
              variationName: eventTicket.name,
              quantity: 1,
              unitPrice: eventTicket.price || 0,
              totalPrice: eventTicket.price || 0
            };
          }
          return null;
        }).filter(Boolean);
      }
      
      // Ensure required fields
      registrationDoc.registrationNumber = registrationDoc.registrationNumber || 
        `REG-${new Date().getFullYear()}-${new ObjectId().toHexString().substr(0, 6).toUpperCase()}`;
      
      // Insert registration
      const regResult = await destinationDb
        .collection('registrations')
        .insertOne(registrationDoc, { session });
      
      // Create tickets if needed
      if (mappings.tickets && registrationDoc.purchase?.items) {
        const tickets = [];
        
        for (const lineItem of registrationDoc.purchase.items) {
          if (lineItem.productType === 'ticket') {
            for (let i = 0; i < lineItem.quantity; i++) {
              const ticketDoc = this.applyMapping(
                { ...sourceDoc, lineItem },
                mappings.tickets,
                this.getDefaultMapping('tickets')
              );
              
              // Set required fields
              ticketDoc.ticketNumber = this.generateTicketNumber(
                lineItem.functionId || 'FUNC',
                lineItem.eventId || 'EVENT'
              );
              
              ticketDoc.purchase = {
                registrationId: regResult.insertedId,
                registrationNumber: registrationDoc.registrationNumber,
                purchasedBy: registrationDoc.registrant,
                purchaseDate: new Date(),
                paymentStatus: 'pending',
                lineItemId: lineItem.lineItemId,
                pricePaid: lineItem.unitPrice
              };
              
              // Set ownership based on registration type
              ticketDoc.owner = {
                attendeeId: registrationDoc.type === 'individual' && registrationDoc.attendees?.[0] 
                  ? registrationDoc.attendees[0]._id 
                  : null
              };
              
              ticketDoc.status = 'active';
              ticketDoc.metadata = {
                createdAt: new Date(),
                version: 1
              };
              
              tickets.push(ticketDoc);
            }
            
            // Update product inventory
            const productId = lineItem.productId;
            if (productId) {
              await destinationDb.collection('products').updateOne(
                {
                  productId: productId,
                  'inventory.availableCount': { $gte: lineItem.quantity }
                },
                {
                  $inc: {
                    'inventory.soldCount': lineItem.quantity,
                    'inventory.availableCount': -lineItem.quantity,
                    'inventory.version': 1
                  },
                  $set: {
                    'inventory.lastUpdated': new Date()
                  }
                },
                { session }
              );
            }
          }
        }
        
        if (tickets.length > 0) {
          const ticketResult = await destinationDb
            .collection('tickets')
            .insertMany(tickets, { session });
          
          // Update registration with ticket IDs
          const updates = [];
          let ticketIndex = 0;
          
          for (let i = 0; i < registrationDoc.purchase.items.length; i++) {
            const item = registrationDoc.purchase.items[i];
            if (item.productType === 'ticket') {
              const ticketIds = [];
              for (let j = 0; j < item.quantity; j++) {
                ticketIds.push(ticketResult.insertedIds[ticketIndex++]);
              }
              updates.push({
                updateOne: {
                  filter: { 
                    _id: regResult.insertedId,
                    'purchase.items.lineItemId': item.lineItemId 
                  },
                  update: { 
                    $set: { 
                      'purchase.items.$.ticketIds': ticketIds 
                    } 
                  }
                }
              });
            }
          }
          
          if (updates.length > 0) {
            await destinationDb
              .collection('registrations')
              .bulkWrite(updates, { session });
          }
        }
      }
      
      // Create financial transaction
      if (mappings['financial-transactions']) {
        const transactionDoc = this.applyMapping(
          sourceDoc,
          mappings['financial-transactions'],
          this.getDefaultMapping('financial-transactions')
        );
        
        transactionDoc.transactionId = this.generateTransactionId();
        transactionDoc.reference = {
          type: 'registration',
          id: regResult.insertedId,
          number: registrationDoc.registrationNumber,
          functionId: registrationDoc.functionId
        };
        
        await destinationDb
          .collection('financial-transactions')
          .insertOne(transactionDoc, { session });
      }
      
      return regResult;
    });
  }
  
  /**
   * Migrate a simple document (no transactions needed)
   */
  async migrateSimpleDocument(
    sourceDoc: any,
    destinationCollection: string,
    mapping: Record<string, any>
  ): Promise<any> {
    const destinationDb = getDestinationDb();
    const defaultMapping = this.getDefaultMapping(destinationCollection);
    
    const transformedDoc = this.applyMapping(sourceDoc, mapping, defaultMapping);
    
    // Add migration metadata
    transformedDoc.metadata = {
      ...transformedDoc.metadata,
      migrated: true,
      migratedAt: new Date(),
      sourceId: sourceDoc._id
    };
    
    return await destinationDb
      .collection(destinationCollection)
      .insertOne(transformedDoc);
  }
  
  /**
   * Generate ticket number
   */
  private generateTicketNumber(functionId: string, eventId: string): string {
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `TKT-${functionId.toUpperCase().substr(0, 6)}-${eventId.toUpperCase().substr(0, 3)}-${random}`;
  }
  
  /**
   * Generate transaction ID
   */
  private generateTransactionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `TXN-${timestamp}-${random}`.toUpperCase();
  }
  
  /**
   * Check if document already migrated
   */
  async isAlreadyMigrated(sourceId: any, destinationCollection: string): Promise<boolean> {
    const destinationDb = getDestinationDb();
    
    const existing = await destinationDb
      .collection(destinationCollection)
      .findOne({ 'metadata.sourceId': sourceId });
    
    return !!existing;
  }
  
  /**
   * Extract event_ticket_ids from a registration document
   */
  private extractEventTicketIds(sourceDoc: any): string[] {
    const ticketIds: string[] = [];
    
    // Check for tickets array with event_ticket_id
    if (sourceDoc.tickets && Array.isArray(sourceDoc.tickets)) {
      sourceDoc.tickets.forEach((ticket: any) => {
        if (ticket.eventTicketId || ticket.event_ticket_id) {
          ticketIds.push(ticket.eventTicketId || ticket.event_ticket_id);
        }
      });
    }
    
    // Check registrationData for ticket information
    if (sourceDoc.registrationData) {
      const regData = sourceDoc.registrationData;
      
      // Check attendees for event_ticket_id
      if (regData.attendees && Array.isArray(regData.attendees)) {
        regData.attendees.forEach((attendee: any) => {
          if (attendee.eventTicketId || attendee.event_ticket_id) {
            ticketIds.push(attendee.eventTicketId || attendee.event_ticket_id);
          }
        });
      }
      
      // Check for line items or purchase items
      if (regData.lineItems && Array.isArray(regData.lineItems)) {
        regData.lineItems.forEach((item: any) => {
          if (item.eventTicketId || item.event_ticket_id) {
            ticketIds.push(item.eventTicketId || item.event_ticket_id);
          }
        });
      }
    }
    
    // Remove duplicates
    return [...new Set(ticketIds)];
  }
}