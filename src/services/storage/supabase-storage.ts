import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY) as string;

let supabase: any = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

function ensureSupabase() {
  if (!supabase) throw new Error('Supabase client not initialized');
  return supabase;
}

export async function ensureBucketExists(bucket: string): Promise<void> {
  const client = ensureSupabase();
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) throw listError;
  if (buckets?.some((b: any) => b.name === bucket)) return;
  const { error: createError } = await client.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf'],
  });
  if (createError) throw createError;
}

export async function uploadBuffer(
  bucket: string,
  path: string,
  buffer: Buffer,
  contentType: string = 'application/pdf',
  makePublic: boolean = true
): Promise<{ publicUrl?: string; path: string }> {
  const client = ensureSupabase();
  await ensureBucketExists(bucket);

  // Supabase JS accepts Blob|File|ArrayBuffer; Node 18+ has Blob
  const blob = new Blob([buffer], { type: contentType });
  const { error } = await client.storage.from(bucket).upload(path, blob, { upsert: true, contentType });
  if (error) throw error;

  if (makePublic) {
    const { data: { publicUrl } } = client.storage.from(bucket).getPublicUrl(path);
    return { publicUrl, path };
  }
  return { path };
}

export async function getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string> {
  const client = ensureSupabase();
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

