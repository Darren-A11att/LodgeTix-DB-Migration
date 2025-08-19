import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!;

let supabase: any;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const BUCKET_NAME = 'invoices';

/**
 * Create the invoices bucket if it doesn't exist
 */
async function ensureBucketExists() {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error('Error listing buckets:', listError);
    throw listError;
  }

  const bucketExists = buckets?.some((bucket: any) => bucket.name === BUCKET_NAME);

  if (!bucketExists) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['application/pdf']
    });

    if (createError) {
      console.error('Error creating bucket:', createError);
      throw createError;
    }
  }
}

/**
 * Upload a PDF to Supabase storage
 * @param pdfBlob - The PDF blob to upload
 * @param invoiceNumber - The invoice number (used for filename)
 * @param invoiceType - 'customer' or 'supplier'
 * @returns The public URL of the uploaded PDF
 */
export async function uploadPDFToSupabase(
  pdfBlob: Blob,
  invoiceNumber: string,
  invoiceType: 'customer' | 'supplier'
): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Please check your environment variables.');
  }

  try {
    // Ensure bucket exists
    await ensureBucketExists();

    // Create path with year/month structure
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const path = `${year}/${month}/${invoiceType}/${invoiceNumber}.pdf`;

    // Upload the file
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true // Overwrite if exists
      });

    if (error) {
      console.error('Error uploading PDF:', error);
      throw error;
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    return publicUrl;
  } catch (error) {
    console.error('Failed to upload PDF to Supabase:', error);
    throw error;
  }
}

/**
 * Delete a PDF from Supabase storage
 * @param path - The path of the file to delete
 */
export async function deletePDFFromSupabase(path: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    console.error('Error deleting PDF:', error);
    throw error;
  }
}

/**
 * Get a signed URL for temporary access to a private PDF
 * @param path - The path of the file
 * @param expiresIn - Expiration time in seconds (default 1 hour)
 * @returns The signed URL
 */
export async function getSignedPDFUrl(path: string, expiresIn: number = 3600): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error('Error creating signed URL:', error);
    throw error;
  }

  return data.signedUrl;
}