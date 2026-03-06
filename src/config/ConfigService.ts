/**
 * Configuration service singleton.
 * Wraps electron-store for persistent config.
 * Adapted from wow-recorder's ConfigService.
 */
import Store from 'electron-store';
import { ConfigurationSchema, configDefaults } from './configSchema';

export default class ConfigService {
  private static instance: ConfigService;
  private store: Store<ConfigurationSchema>;

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private constructor() {
    this.store = new Store<ConfigurationSchema>({
      defaults: configDefaults,
    });
  }

  get<K extends keyof ConfigurationSchema>(
    key: K,
  ): ConfigurationSchema[K] {
    return this.store.get(key);
  }

  set<K extends keyof ConfigurationSchema>(
    key: K,
    value: ConfigurationSchema[K],
  ) {
    this.store.set(key, value);
  }

  getAll(): ConfigurationSchema {
    return this.store.store;
  }

  getStorePath(): string {
    return this.store.path;
  }
}
