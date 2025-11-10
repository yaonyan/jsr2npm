import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

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
  dependencies?: Record<string, string>;
}

export interface PackageConfig {
  name: string;
  version: string;
  // CLI commands configuration: { "command-name": "src/file.ts" }
  bin?: Record<string, string>;
  packageJson?: PackageOverrides;
  // Whether this is a browser-compatible package (default false uses node platform; set true to use neutral platform)
  browser?: boolean;
}

export interface Config {
  packages: PackageConfig[];
}

export async function loadConfig(configPath: string): Promise<Config | null> {
  try {
    const absolutePath = resolve(process.cwd(), configPath);
    const content = await readFile(absolutePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
