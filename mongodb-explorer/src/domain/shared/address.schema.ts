import { z } from 'zod';

// Address schema
export const AddressSchema = z.object({
  address_1: z.string().optional(),
  address_2: z.string().optional(),
  city: z.string().optional(),
  country_code: z.string().optional(),
  phone: z.string().optional(),
  postal_code: z.string().optional(),
  province: z.string().optional(),
  company: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional()
});

export type Address = z.infer<typeof AddressSchema>;