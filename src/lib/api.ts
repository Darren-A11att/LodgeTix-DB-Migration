import axios from 'axios';
import { DatabaseSelector } from './database-selector';

// Use relative API URL for Next.js routes
const API_BASE_URL = '/api';

export interface Collection {
  name: string;
  count: number;
}

export interface DocumentsResponse {
  documents: any[];
  total: number;
  limit: number;
  skip: number;
  collection: string;
}

class ApiService {
  async getCollections(databaseName?: string): Promise<Collection[]> {
    const currentDb = databaseName || DatabaseSelector.getSelectedDatabase().id;
    const response = await axios.get(`${API_BASE_URL}/collections`, {
      params: { database: currentDb }
    });
    
    // Handle both old and new response formats
    const data = response.data;
    if (data && typeof data === 'object' && 'collections' in data) {
      // New format with nested collections
      return data.collections || [];
    }
    
    // Legacy format - direct array
    return Array.isArray(data) ? data : [];
  }

  async getDocuments(collectionName: string, skip: number = 0, limit: number = 20, search?: string, sortBy?: string, sortOrder?: string): Promise<DocumentsResponse> {
    const currentDb = DatabaseSelector.getSelectedDatabase().id;
    const response = await axios.get<DocumentsResponse>(
      `${API_BASE_URL}/collections/${collectionName}/documents`,
      { params: { skip, limit, search, sortBy, sortOrder, database: currentDb } }
    );
    return response.data;
  }

  async getDocument(collectionName: string, documentId: string): Promise<any> {
    const response = await axios.get(
      `${API_BASE_URL}/collections/${collectionName}/documents/${documentId}`
    );
    return response.data;
  }

  async globalSearch(query: string): Promise<{ results: any[], total: number, query: string }> {
    const response = await axios.get(
      `${API_BASE_URL}/search`,
      { params: { q: query, limit: 20 } }
    );
    return response.data;
  }

  async searchDocuments(collectionName: string, query: any): Promise<DocumentsResponse> {
    const response = await axios.post<DocumentsResponse>(
      `${API_BASE_URL}/collections/${collectionName}/search`,
      { query }
    );
    return response.data;
  }

  async rawTextSearch(collectionName: string, searchText: string, limit: number = 50): Promise<DocumentsResponse> {
    // For registrations, use the documents endpoint with search parameter
    if (collectionName === 'registrations') {
      const response = await axios.get<DocumentsResponse>(
        `${API_BASE_URL}/collections/registrations/documents`,
        { params: { search: searchText, limit } }
      );
      return response.data;
    }
    
    const response = await axios.post<DocumentsResponse>(
      `${API_BASE_URL}/collections/${collectionName}/raw-search`,
      { searchText, limit }
    );
    return response.data;
  }

  async getInvoiceMatches(limit: number = 20, offset: number = 0): Promise<any> {
    const response = await axios.get(
      `${API_BASE_URL}/invoices/matches`,
      { params: { limit, offset } }
    );
    return response.data;
  }

  async createInvoice(data: { payment: any, registration: any, invoice: any }): Promise<any> {
    const response = await axios.post(
      `${API_BASE_URL}/invoices/create`,
      data
    );
    return response.data;
  }

  async searchInvoicesByPaymentId(paymentId: string): Promise<any> {
    // Use relative URL to hit the Next.js API route
    const response = await axios.get(
      `/api/invoices/search`,
      { params: { paymentId } }
    );
    return response.data;
  }

  async updateRegistration(id: string, updates: any): Promise<any> {
    const response = await axios.patch(
      `${API_BASE_URL}/registrations/${id}`,
      updates
    );
    return response.data;
  }

  async getRegistrationRelatedDocuments(id: string): Promise<any> {
    const response = await axios.get(
      `${API_BASE_URL}/registrations/${id}/related`
    );
    return response.data;
  }

  async getRelatedDocuments(collection: string, documentId: string): Promise<any> {
    const response = await axios.get(
      `${API_BASE_URL}/collections/${collection}/documents/${documentId}/related`
    );
    return response.data;
  }

  async getFunctionById(functionId: string): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}/functions/${functionId}`);
    return response.data;
  }

  // New methods for migration tool
  async get(path: string): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}${path}`);
    return response.data;
  }

  async post(path: string, data: any): Promise<any> {
    const response = await axios.post(`${API_BASE_URL}${path}`, data);
    return response.data;
  }

  async put(path: string, data: any): Promise<any> {
    const response = await axios.put(`${API_BASE_URL}${path}`, data);
    return response.data;
  }

  async updateDocument(collectionName: string, id: string, updates: any): Promise<any> {
    const response = await axios.patch(
      `${API_BASE_URL}/collections/${collectionName}/documents/${id}`,
      updates
    );
    return response.data;
  }
}

export default new ApiService();
