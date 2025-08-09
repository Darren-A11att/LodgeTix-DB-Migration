// Light-weight augmentations to ease component typechecks without changing runtime behavior

declare interface InvoicePayment {
  // Some components reference upstream fields with different casing or passthrough metadata
  Status?: string;
  originalData?: any;
}

// Allow reading Mongo Decimal128-like objects used in some utils/components
declare interface Object {
  $numberDecimal?: string;
}

// Extend ApiService in places where methods are used dynamically
declare class ApiService {
  put?(path: string, data: any): Promise<any>;
  updateDocument?(collection: string, id: string, updates: any): Promise<any>;
}

