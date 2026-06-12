import { kv as vercelKv, createClient } from '@vercel/kv';
import fs from 'fs';
import path from 'path';

// Helper for local JSON file-based Mock KV store
const MOCK_FILE_PATH = path.join(process.cwd(), '.next', 'kv_mock.json');

function readMockStore(): Record<string, any> {
  try {
    if (!fs.existsSync(MOCK_FILE_PATH)) {
      // Ensure the directory exists
      const dir = path.dirname(MOCK_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(MOCK_FILE_PATH, '{}', 'utf8');
      return {};
    }
    const data = fs.readFileSync(MOCK_FILE_PATH, 'utf8');
    return JSON.parse(data || '{}');
  } catch (err) {
    console.error('Error reading mock KV store:', err);
    return {};
  }
}

function writeMockStore(store: Record<string, any>) {
  try {
    const dir = path.dirname(MOCK_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MOCK_FILE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing mock KV store:', err);
  }
}

// Check if Vercel KV env vars are set
const isProdKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const isProdRedis = !!(process.env.REDIS_REST_API_URL && process.env.REDIS_REST_API_TOKEN);

export interface KVStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  hset(key: string, value: Record<string, any>): Promise<number>;
  hgetall<T>(key: string): Promise<T | null>;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  lpush(key: string, ...elements: any[]): Promise<number>;
  lrange<T>(key: string, start: number, stop: number): Promise<T[]>;
}

// Determine which KV client to use: KV environment variables, or Redis integration variables
const getActiveClient = (): KVStore => {
  if (isProdKV) {
    return vercelKv as unknown as KVStore;
  }
  if (isProdRedis) {
    return createClient({
      url: process.env.REDIS_REST_API_URL!,
      token: process.env.REDIS_REST_API_TOKEN!,
    }) as unknown as KVStore;
  }
  return null as any;
};

const activeClient = getActiveClient();

export const kv: KVStore = activeClient
  ? activeClient
  : {
      async get<T>(key: string): Promise<T | null> {
        const store = readMockStore();
        const val = store[key];
        return val !== undefined ? (val as T) : null;
      },
      async set(key: string, value: any): Promise<'OK' | null> {
        const store = readMockStore();
        store[key] = value;
        writeMockStore(store);
        return 'OK';
      },
      async del(key: string): Promise<number> {
        const store = readMockStore();
        if (key in store) {
          delete store[key];
          writeMockStore(store);
          return 1;
        }
        return 0;
      },
      async hset(key: string, value: Record<string, any>): Promise<number> {
        const store = readMockStore();
        if (!store[key] || typeof store[key] !== 'object') {
          store[key] = {};
        }
        let added = 0;
        for (const [k, v] of Object.entries(value)) {
          if (store[key][k] === undefined) {
            added++;
          }
          store[key][k] = v;
        }
        writeMockStore(store);
        return added;
      },
      async hgetall<T>(key: string): Promise<T | null> {
        const store = readMockStore();
        const val = store[key];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          return val as T;
        }
        return null;
      },
      async sadd(key: string, ...members: string[]): Promise<number> {
        const store = readMockStore();
        if (!Array.isArray(store[key])) {
          store[key] = [];
        }
        const set = new Set<string>(store[key]);
        let added = 0;
        for (const m of members) {
          if (!set.has(m)) {
            set.add(m);
            added++;
          }
        }
        store[key] = Array.from(set);
        writeMockStore(store);
        return added;
      },
      async srem(key: string, ...members: string[]): Promise<number> {
        const store = readMockStore();
        if (!Array.isArray(store[key])) {
          return 0;
        }
        const set = new Set<string>(store[key]);
        let removed = 0;
        for (const m of members) {
          if (set.has(m)) {
            set.delete(m);
            removed++;
          }
        }
        store[key] = Array.from(set);
        writeMockStore(store);
        return removed;
      },
      async smembers(key: string): Promise<string[]> {
        const store = readMockStore();
        return Array.isArray(store[key]) ? store[key] : [];
      },
      async lpush(key: string, ...elements: any[]): Promise<number> {
        const store = readMockStore();
        if (!Array.isArray(store[key])) {
          store[key] = [];
        }
        // lpush prepends elements in reverse order of args to make lpush(a, b) result in [b, a, ...]
        const reversed = [...elements].reverse();
        store[key] = [...reversed, ...store[key]];
        writeMockStore(store);
        return store[key].length;
      },
      async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
        const store = readMockStore();
        if (!Array.isArray(store[key])) {
          return [];
        }
        const list = store[key] as T[];
        const len = list.length;
        let actualStart = start < 0 ? len + start : start;
        let actualStop = stop < 0 ? len + stop : stop;
        actualStart = Math.max(0, actualStart);
        actualStop = Math.min(len - 1, actualStop);
        if (actualStart > actualStop) return [];
        return list.slice(actualStart, actualStop + 1);
      },
    };
