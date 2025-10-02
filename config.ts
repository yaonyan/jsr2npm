export interface PackageOverrides {
  name?: string;
  version?: string;
  description?: string;
  license?: string;
  author?: string | { name: string; email?: string; url?: string };
  repository?: string | { type: string; url: string };
  homepage?: string;
  keywords?: string[];
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface EntrypointConfig {
  input: string;      // 输入文件，如 "mod.ts", "cli.ts"
  output: string;     // 输出文件，如 "index.mjs", "bin/cli.mjs"
  type?: "module" | "bin";  // 类型：模块或可执行文件
  binName?: string;   // bin 类型的命令名（可选，默认从 output 提取）
}

export interface PackageConfig {
  name: string;
  version: string;
  // 向后兼容：支持单入口点字符串
  entrypoint?: string;
  // 新功能：支持多入口点数组
  entrypoints?: EntrypointConfig[];
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
