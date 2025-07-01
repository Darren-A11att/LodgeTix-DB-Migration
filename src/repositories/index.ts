import { Db } from 'mongodb';
import { EventsRepository } from './events.repository';

export class Repositories {
  public events: EventsRepository;
  // Add other repositories here as you convert them

  constructor(database: Db) {
    this.events = new EventsRepository(database);
    // Initialize other repositories
  }
}

export * from './events.repository';
// Export other repositories as you create them