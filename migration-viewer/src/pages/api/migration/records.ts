import type { NextApiRequest, NextApiResponse } from 'next'
import { promises as fs } from 'fs'
import path from 'path'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { type } = req.query

  if (!type || typeof type !== 'string') {
    return res.status(400).json({ error: 'Type parameter is required' })
  }

  try {
    const outputDir = path.join(process.cwd(), '..', 'test-migration-output', type)
    const files = await fs.readdir(outputDir)
    const jsonFiles = files.filter(f => f.endsWith('.json'))

    const records = await Promise.all(
      jsonFiles.slice(0, 100).map(async (file) => { // Limit to 100 for performance
        const filePath = path.join(outputDir, file)
        const content = await fs.readFile(filePath, 'utf-8')
        const data = JSON.parse(content)

        // Extract summary based on type
        let summary: any = {
          _id: data._id,
          type: type
        }

        switch (type) {
          case 'orders':
            summary.orderNumber = data.orderNumber
            summary.status = data.status
            summary.name = data.customer?.rawData?.name || data.customer?.name
            break
          case 'catalog-objects':
            summary.name = data.name
            summary.status = data.status
            break
          case 'contacts':
            summary.name = data.name
            summary.email = data.email
            break
          case 'jurisdictions':
          case 'organisations':
            summary.name = data.name
            break
          case 'tickets':
            summary.originalId = data.ticketId
            summary.status = data.status
            break
        }

        return summary
      })
    )

    res.status(200).json(records)
  } catch (error) {
    console.error('Error fetching records:', error)
    res.status(500).json({ error: 'Failed to fetch records' })
  }
}