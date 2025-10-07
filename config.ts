export interface PackageOverrides {
  name?: string;
  version?: string;
  description?: string;
  license?: string;
  author?: string | { name: string; email?: string; url?: string };
  repository?: string | { type: string; url: string };
  homepage?: string;
  keywords?: string[];
  scripts?: Record<string, string>;
}

export interface PackageConfig {
  name: string;
  version: string;
  // CLI 命令配置：{ "command-name": "src/file.ts" }
  bin?: Record<string, string>;
  packageJson?: PackageOverrides;
}

export interface Config {
  packages: PackageConfig[];
}

export async function loadConfig(configPath: string): Promise<Config | null> {
  try {
    const content = await Deno.readTextFile(configPath);
    return JSON.parse(content);
  } catch {
    return null;
  }
}
