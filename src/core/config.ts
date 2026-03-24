/**
 * ConfigPort interface + FsConfigAdapter implementation.
 * Read-only access to legacy config.json for backward compatibility.
 * New code should use SettingsPort from core/settings.ts.
 *
 * @deprecated Use SettingsPort for new consumers. ConfigPort is read-only.
 */

import * as path from 'path';
import { homedir } from 'os';
import { HiveConfig, DEFAULT_HIVE_CONFIG, AGENT_NAMES } from './types.ts';
import { readJson, fileExists } from './fs-io.ts';

export interface ConfigPort {
  get(): HiveConfig;
}

export class FsConfigAdapter implements ConfigPort {
  private configPath: string;
  private cachedConfig: HiveConfig | null = null;

  constructor() {
    const configDir = path.join(homedir(), '.maestro');
    this.configPath = path.join(configDir, 'config.json');
  }

  getPath(): string {
    return this.configPath;
  }

  get(): HiveConfig {
    if (this.cachedConfig !== null) {
      return this.cachedConfig;
    }
    try {
      const stored = readJson<Partial<HiveConfig>>(this.configPath);
      if (!stored) {
        this.cachedConfig = { ...DEFAULT_HIVE_CONFIG };
        return this.cachedConfig;
      }

      const agents: HiveConfig['agents'] = { ...DEFAULT_HIVE_CONFIG.agents };
      for (const name of AGENT_NAMES) {
        agents[name] = { ...DEFAULT_HIVE_CONFIG.agents?.[name], ...stored.agents?.[name] };
      }
      const merged: HiveConfig = { ...DEFAULT_HIVE_CONFIG, ...stored, agents };
      this.cachedConfig = merged;
      return this.cachedConfig;
    } catch {
      this.cachedConfig = { ...DEFAULT_HIVE_CONFIG };
      return this.cachedConfig;
    }
  }

  exists(): boolean {
    return fileExists(this.configPath);
  }
}
