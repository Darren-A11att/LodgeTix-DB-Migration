import type { NextApiRequest, NextApiResponse } from 'next'
import { promises as fs } from 'fs'
import path from 'path'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const outputDir = path.join(process.cwd(), '..', 'test-migration-output')
    
    const stats = {
      catalogObjects: 0,
      orders: 0,
      contacts: 0,
      jurisdictions: 0,
      organisations: 0,
      financialTransactions: 0,
      tickets: 0
    }

    const collections = [
      { dir: 'catalog-objects', key: 'catalogObjects' },
      { dir: 'orders', key: 'orders' },
      { dir: 'contacts', key: 'contacts' },
      { dir: 'jurisdictions', key: 'jurisdictions' },
      { dir: 'organisations', key: 'organisations' },
      { dir: 'financial-transactions', key: 'financialTransactions' },
      { dir: 'tickets', key: 'tickets' }
    ]

    for (const collection of collections) {
      try {
        const dirPath = path.join(outputDir, collection.dir)
        const files = await fs.readdir(dirPath)
        stats[collection.key as keyof typeof stats] = files.filter(f => f.endsWith('.json')).length
      } catch (error) {
        // Directory might not exist
        console.log(`Directory ${collection.dir} not found`)
      }
    }

    res.status(200).json(stats)
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ error: 'Failed to fetch migration stats' })
  }
}