import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

interface Config {
  supabase: {
    url: string;
    key: string;
  };
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  mongodb: {
    uri: string;
    database: string;
    username?: string;
    password?: string;
  };
  migration: {
    batchSize: number;
    logLevel: string;
  };
}

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
};

const getOptionalEnv = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

export const config: Config = {
  supabase: {
    url: getRequiredEnv('SUPABASE_URL'),
    key: getRequiredEnv('SUPABASE_KEY'),
  },
  postgres: {
    host: getOptionalEnv('POSTGRES_HOST', 'localhost'),
    port: parseInt(getOptionalEnv('POSTGRES_PORT', '5432'), 10),
    database: getRequiredEnv('POSTGRES_DATABASE'),
    user: getRequiredEnv('POSTGRES_USER'),
    password: getRequiredEnv('POSTGRES_PASSWORD'),
  },
  mongodb: {
    uri: getRequiredEnv('MONGODB_URI'),
    database: getRequiredEnv('MONGODB_DATABASE'),
    username: getOptionalEnv('MONGODB_USERNAME', ''),
    password: getOptionalEnv('MONGODB_PASSWORD', ''),
  },
  migration: {
    batchSize: parseInt(getOptionalEnv('BATCH_SIZE', '1000'), 10),
    logLevel: getOptionalEnv('LOG_LEVEL', 'info'),
  },
};