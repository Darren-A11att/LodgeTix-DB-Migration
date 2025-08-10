import { z } from 'zod';

// Money schema for handling prices and amounts
export const Money = z.object({
  amount: z.number(),
  currency_code: z.string().length(3).toUpperCase(),
  includes_tax: z.boolean().default(false)
});

export type MoneyType = z.infer<typeof Money>;