import { z } from 'zod';

// Base schema for all entities
export const BaseSchema = z.object({
  _id: z.string().optional(),
  id: z.string().optional(),
  created_at: z.date().or(z.string()).transform(val => typeof val === 'string' ? new Date(val) : val).optional(),
  updated_at: z.date().or(z.string()).transform(val => typeof val === 'string' ? new Date(val) : val).optional(),
  deleted_at: z.date().or(z.string()).transform(val => typeof val === 'string' ? new Date(val) : val).optional()
});

// Base document type
export type BaseDocument = {
  _id?: string;
  id?: string;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
};