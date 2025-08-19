/**
 * Clean invoice data before storing in database
 * Removes mapping configurations and keeps only the resolved values
 */
export function cleanInvoiceData(invoice: any): any {
  if (!invoice) return null;

  // Deep clone the invoice to avoid mutating the original
  const cleaned = JSON.parse(JSON.stringify(invoice));

  // Clean line items - remove mapping configurations
  if (cleaned.items && Array.isArray(cleaned.items)) {
    cleaned.items = cleaned.items.map((item: any) => {
      // Keep only the essential fields for the invoice
      const cleanItem: any = {
        description: item.description,
        quantity: typeof item.quantity === 'number' ? item.quantity : 1,
        price: typeof item.price === 'number' ? item.price : 0
      };

      // If there are sub-items, clean them too
      if (item.subItems && Array.isArray(item.subItems)) {
        cleanItem.subItems = item.subItems.map((subItem: any) => ({
          description: subItem.description,
          quantity: typeof subItem.quantity === 'number' ? subItem.quantity : 1,
          price: typeof subItem.price === 'number' ? subItem.price : 0
        }));
      }

      return cleanItem;
    });
  }

  // Remove mapping-related fields from the invoice
  delete cleaned.lineItemMappings;
  delete cleaned.lineItems;
  delete cleaned.arrayMappings;
  delete cleaned.fieldMappingConfig;
  delete cleaned.descriptionSegments;
  delete cleaned.quantityMapping;
  delete cleaned.priceMapping;

  // Clean any nested objects that might contain mappings
  if (cleaned.lineItems) {
    delete cleaned.lineItems;
  }

  return cleaned;
}