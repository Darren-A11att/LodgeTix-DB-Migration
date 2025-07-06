import type { NextApiRequest, NextApiResponse } from 'next'
import { promises as fs } from 'fs'
import path from 'path'
import { MongoClient } from 'mongodb'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dirty'

async function getOriginalRecord(type: string, id: string) {
  const client = new MongoClient(MONGO_URI)
  
  try {
    await client.connect()
    const db = client.db('dirty')
    
    let collection: string
    let query: any = { _id: id }
    
    switch (type) {
      case 'orders':
        collection = 'registrations'
        break
      case 'catalog-objects':
        collection = 'functions'
        break
      case 'contacts':
        collection = 'attendees'
        break
      case 'jurisdictions':
        // Could be either grand_lodges or lodges
        const grandLodge = await db.collection('grand_lodges').findOne(query)
        if (grandLodge) return grandLodge
        return await db.collection('lodges').findOne(query)
      case 'organisations':
        collection = 'organisations'
        break
      case 'tickets':
        collection = 'tickets'
        break
      default:
        return null
    }
    
    if (collection) {
      return await db.collection(collection).findOne(query)
    }
    
    return null
  } finally {
    await client.close()
  }
}

function generateMapping(type: string): any[] {
  switch (type) {
    case 'orders':
      return [
        { field: 'ID', originalPath: '_id', migratedPath: '_id' },
        { field: 'Order Number', originalPath: 'registrationNumber', migratedPath: 'orderNumber' },
        { field: 'Status', originalPath: 'status', migratedPath: 'status' },
        { field: 'Customer Name', originalPath: 'organisation.name', migratedPath: 'customer.rawData.name' },
        { field: 'Customer Type', originalPath: 'registrationType', migratedPath: 'customer.type', transformation: 'lodge → organisation, individual → individual' },
        { field: 'Total Amount', originalPath: 'totalAmount', migratedPath: 'totals.total' },
        { field: 'Created Date', originalPath: 'createdAt', migratedPath: 'metadata.createdAt' }
      ]
    case 'catalog-objects':
      return [
        { field: 'ID', originalPath: '_id', migratedPath: '_id' },
        { field: 'Name', originalPath: 'name', migratedPath: 'name' },
        { field: 'Description', originalPath: 'description', migratedPath: 'description' },
        { field: 'Status', originalPath: 'status', migratedPath: 'status' },
        { field: 'Start Date', originalPath: 'functionStart', migratedPath: 'dates.startDate' },
        { field: 'End Date', originalPath: 'functionEnd', migratedPath: 'dates.endDate' }
      ]
    case 'contacts':
      return [
        { field: 'ID', originalPath: '_id', migratedPath: '_id' },
        { field: 'Name', originalPath: 'name', migratedPath: 'name' },
        { field: 'Email', originalPath: 'email', migratedPath: 'email' },
        { field: 'Phone', originalPath: 'phone', migratedPath: 'phone' },
        { field: 'Type', originalPath: 'type', migratedPath: 'type', transformation: 'attendee → contact' }
      ]
    case 'organisations':
      return [
        { field: 'ID', originalPath: '_id', migratedPath: '_id' },
        { field: 'Name', originalPath: 'name', migratedPath: 'name' },
        { field: 'Type', originalPath: 'type', migratedPath: 'type' },
        { field: 'ABN', originalPath: 'abn', migratedPath: 'identifiers.abn' },
        { field: 'Lodge Number', originalPath: 'lodgeNumber', migratedPath: 'metadata.lodgeDetails.lodgeNumber' }
      ]
    default:
      return []
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { type, id } = req.query

  if (!type || !id || typeof type !== 'string' || typeof id !== 'string') {
    return res.status(400).json({ error: 'Type and ID parameters are required' })
  }

  try {
    // Get migrated record
    const migratedPath = path.join(process.cwd(), '..', 'test-migration-output', type, `${id}.json`)
    const migratedContent = await fs.readFile(migratedPath, 'utf-8')
    const migrated = JSON.parse(migratedContent)

    // Get original record from MongoDB
    const original = await getOriginalRecord(type, id)

    if (!original) {
      return res.status(404).json({ error: 'Original record not found' })
    }

    // Generate field mapping
    const mapping = generateMapping(type)

    res.status(200).json({
      original,
      migrated,
      mapping
    })
  } catch (error) {
    console.error('Error fetching comparison data:', error)
    res.status(500).json({ error: 'Failed to fetch comparison data' })
  }
}