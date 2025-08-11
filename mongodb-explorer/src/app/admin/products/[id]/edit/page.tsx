'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Plus, Trash2, Package, Box, Grid } from 'lucide-react';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

// Define Zod schemas for validation
const bundleItemSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  variant_id: z.string().optional(),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  is_required: z.boolean().optional(),
  discount_amount: z.number().min(0).optional(),
  discount_percentage: z.number().min(0).max(100).optional(),
});

const kitContentSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  variant_id: z.string().optional(),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
});

const productSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  handle: z.string().min(1, 'Handle is required').regex(/^[a-z0-9-]+$/, 'Handle must be lowercase with dashes only'),
  description: z.string().optional(),
  type: z.enum(['simple', 'variant', 'bundle', 'kit', 'digital', 'service', 'subscription']),
  status: z.enum(['draft', 'proposed', 'published', 'rejected']),
  collection_id: z.string().optional(),
  vendor_id: z.string().optional(),
  price: z.number().min(0).optional(),
  bundleItems: z.array(bundleItemSchema).optional(),
  bundle_items: z.array(bundleItemSchema).optional(), // Support both naming conventions
  kitContents: z.array(kitContentSchema).optional(),
  kit_contents: z.array(kitContentSchema).optional(), // Support both naming conventions
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  options: z.array(z.string()).optional(),
  weight: z.number().min(0).optional(),
  requires_shipping: z.boolean().optional(),
  taxable: z.boolean().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface Product extends ProductFormData {
  _id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ProductOption {
  _id: string;
  title: string;
  handle: string;
  type: string;
}

export default function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const [productId, setProductId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<ProductOption[]>([]);
  const [availableCollections, setAvailableCollections] = useState<any[]>([]);
  const [availableVendors, setAvailableVendors] = useState<any[]>([]);
  const router = useRouter();

  // Initialize form with react-hook-form
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      type: 'simple',
      status: 'draft',
      requires_shipping: true,
      taxable: true,
      bundleItems: [],
      bundle_items: [],
      kitContents: [],
      kit_contents: [],
      tags: [],
      options: [],
      metadata: {},
    },
  });

  const { fields: bundleFields, append: appendBundle, remove: removeBundle } = useFieldArray({
    control,
    name: 'bundleItems',
  });

  const { fields: kitFields, append: appendKit, remove: removeKit } = useFieldArray({
    control,
    name: 'kitContents',
  });

  const { fields: tagFields, append: appendTag, remove: removeTag } = useFieldArray({
    control,
    name: 'tags',
  });

  const watchedType = watch('type');

  useEffect(() => {
    const initializeData = async () => {
      const resolvedParams = await params;
      setProductId(resolvedParams.id);
      await Promise.all([
        fetchProduct(resolvedParams.id),
        fetchAvailableProducts(),
        fetchAvailableCollections(),
        fetchAvailableVendors(),
      ]);
      setLoading(false);
    };

    initializeData();
  }, [params]);

  const fetchProduct = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/products/${id}`);
      if (!response.ok) throw new Error('Failed to fetch product');
      const { data } = await response.json();
      
      // Reset form with fetched data
      reset({
        ...data,
        tags: data.tags || [],
        options: data.options || [],
        bundleItems: data.bundleItems || data.bundle_items || [],
        kitContents: data.kitContents || data.kit_contents || [],
        metadata: data.metadata || {},
      });
    } catch (error) {
      console.error('Error fetching product:', error);
    }
  };

  const fetchAvailableProducts = async () => {
    try {
      const response = await fetch('/api/admin/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      const { data } = await response.json();
      setAvailableProducts(data.filter((p: Product) => p._id !== productId));
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchAvailableCollections = async () => {
    try {
      const response = await fetch('/api/admin/product_collections');
      if (!response.ok) throw new Error('Failed to fetch collections');
      const { data } = await response.json();
      setAvailableCollections(data);
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  };

  const fetchAvailableVendors = async () => {
    try {
      const response = await fetch('/api/admin/vendors');
      if (!response.ok) throw new Error('Failed to fetch vendors');
      const { data } = await response.json();
      setAvailableVendors(data);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const onSubmit = async (data: ProductFormData) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update product');
      }
      
      // Success notification
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      successMessage.textContent = 'Product updated successfully!';
      document.body.appendChild(successMessage);
      
      setTimeout(() => {
        successMessage.remove();
        router.push('/admin/products');
      }, 1500);
      
    } catch (error) {
      console.error('Error updating product:', error);
      
      // Error notification
      const errorMessage = document.createElement('div');
      errorMessage.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      errorMessage.textContent = error instanceof Error ? error.message : 'Failed to update product. Please try again.';
      document.body.appendChild(errorMessage);
      
      setTimeout(() => errorMessage.remove(), 3000);
    } finally {
      setSaving(false);
    }
  };

  const addBundleItem = () => {
    appendBundle({
      product_id: '',
      variant_id: '',
      quantity: 1,
      is_required: true,
      discount_amount: 0,
      discount_percentage: 0,
    });
  };

  const addKitContent = () => {
    appendKit({
      product_id: '',
      variant_id: '',
      quantity: 1,
    });
  };

  const addTag = () => {
    appendTag('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              <div className="h-32 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
          </div>
          <div className="flex items-center space-x-4">
            <SimpleDatabaseSelector className="w-64" />
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  {...register('title')}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Handle *
                </label>
                <input
                  {...register('handle')}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.handle && (
                  <p className="mt-1 text-sm text-red-600">{errors.handle.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type *
                </label>
                <select
                  {...register('type')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="simple">Simple</option>
                  <option value="variant">Variant</option>
                  <option value="bundle">Bundle</option>
                  <option value="kit">Kit</option>
                  <option value="digital">Digital</option>
                  <option value="service">Service</option>
                  <option value="subscription">Subscription</option>
                </select>
                {errors.type && (
                  <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  {...register('status')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="draft">Draft</option>
                  <option value="proposed">Proposed</option>
                  <option value="published">Published</option>
                  <option value="rejected">Rejected</option>
                </select>
                {errors.status && (
                  <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Collection
                </label>
                <select
                  {...register('collection_id')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a collection</option>
                  {availableCollections.map((collection) => (
                    <option key={collection._id} value={collection._id}>
                      {collection.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vendor
                </label>
                <select
                  {...register('vendor_id')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a vendor</option>
                  {availableVendors.map((vendor) => (
                    <option key={vendor._id} value={vendor._id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Pricing & Inventory */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Pricing & Inventory</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price
                </label>
                <input
                  {...register('price', { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.price && (
                  <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight (kg)
                </label>
                <input
                  {...register('weight', { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    {...register('requires_shipping')}
                    type="checkbox"
                    id="requires_shipping"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="requires_shipping" className="ml-2 text-sm text-gray-700">
                    Requires shipping
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    {...register('taxable')}
                    type="checkbox"
                    id="taxable"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="taxable" className="ml-2 text-sm text-gray-700">
                    Taxable
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Bundle Items - Only show for bundle type */}
          {watchedType === 'bundle' && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center">
                  <Package className="h-5 w-5 mr-2" />
                  Bundle Items
                </h2>
                <button
                  type="button"
                  onClick={addBundleItem}
                  className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </button>
              </div>

              <div className="space-y-4">
                {bundleFields.map((field, index) => (
                  <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-medium text-gray-900">Bundle Item {index + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeBundle(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Product *
                        </label>
                        <select
                          {...register(`bundleItems.${index}.product_id`)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select product</option>
                          {availableProducts.map((product) => (
                            <option key={product._id} value={product._id}>
                              {product.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantity *
                        </label>
                        <input
                          {...register(`bundleItems.${index}.quantity`, { valueAsNumber: true })}
                          type="number"
                          min="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Discount Amount
                        </label>
                        <input
                          {...register(`bundleItems.${index}.discount_amount`, { valueAsNumber: true })}
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Discount %
                        </label>
                        <input
                          {...register(`bundleItems.${index}.discount_percentage`, { valueAsNumber: true })}
                          type="number"
                          min="0"
                          max="100"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center">
                        <input
                          {...register(`bundleItems.${index}.is_required`)}
                          type="checkbox"
                          id={`bundle-required-${index}`}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`bundle-required-${index}`} className="ml-2 text-sm text-gray-700">
                          Required item
                        </label>
                      </div>
                    </div>
                  </div>
                ))}

                {bundleFields.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No bundle items added yet.</p>
                    <p className="text-sm">Click "Add Item" to add products to this bundle.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Kit Contents - Only show for kit type */}
          {watchedType === 'kit' && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center">
                  <Box className="h-5 w-5 mr-2" />
                  Kit Contents
                </h2>
                <button
                  type="button"
                  onClick={addKitContent}
                  className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Content
                </button>
              </div>

              <div className="space-y-4">
                {kitFields.map((field, index) => (
                  <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-medium text-gray-900">Kit Content {index + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeKit(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Product *
                        </label>
                        <select
                          {...register(`kitContents.${index}.product_id`)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select product</option>
                          {availableProducts.map((product) => (
                            <option key={product._id} value={product._id}>
                              {product.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantity *
                        </label>
                        <input
                          {...register(`kitContents.${index}.quantity`, { valueAsNumber: true })}
                          type="number"
                          min="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {kitFields.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Box className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No kit contents added yet.</p>
                    <p className="text-sm">Click "Add Content" to add products to this kit.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Tags</h2>
              <button
                type="button"
                onClick={addTag}
                className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Tag
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tagFields.map((field, index) => (
                <div key={field.id} className="flex">
                  <input
                    {...register(`tags.${index}`)}
                    type="text"
                    placeholder="Enter tag"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeTag(index)}
                    className="px-3 py-2 bg-red-600 text-white rounded-r-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}