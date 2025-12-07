import { AdminConfig } from './admin.types';
import { Favorite, PlayRecord, SkipConfig } from './types';

export type MigrationUserData = {
  playRecords?: Record<string, PlayRecord>;
  favorites?: Record<string, Favorite>;
  searchHistory?: string[];
  skipConfigs?: Record<string, SkipConfig>;
  password?: string | null;
};

export type MigrationPayload = {
  timestamp: string;
  serverVersion: string;
  data: {
    adminConfig: AdminConfig;
    userData: Record<string, MigrationUserData>;
  };
};

export function isMigrationPayload(payload: unknown): payload is MigrationPayload {
  if (!payload || typeof payload !== 'object') return false;
  const root = payload as Record<string, unknown>;
  if (typeof root.timestamp !== 'string' || typeof root.serverVersion !== 'string') {
    return false;
  }

  const data = root.data;
  if (!data || typeof data !== 'object') return false;

  const { adminConfig, userData } = data as Record<string, unknown>;
  if (!adminConfig || typeof userData !== 'object' || userData === null) {
    return false;
  }

  return true;
}
