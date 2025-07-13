import type { NextApiRequest, NextApiResponse } from 'next';

// Although the imported script is JS, TypeScript can import it.
// For better type safety, this script could also be converted to TS.
import { createIndexes } from '../../../scripts/mongodb-setup/03-create-indexes';

type ResponseData = {
  message: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await createIndexes();
    res.status(200).json({ message: 'Indexes created successfully!' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create indexes.', error: error.message });
  }
}