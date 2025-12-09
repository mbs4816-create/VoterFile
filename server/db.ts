import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { Pool } from 'pg';
import * as schema from '@shared/schema';

const connectionString = process.env.DATABASE_URL!;

// For query operations
const queryClient = postgres(connectionString);

// For migrations and operations
export const db = drizzle(queryClient, { schema });

// For session store (pg pool)
export const pool = new Pool({ connectionString });

export { schema };
