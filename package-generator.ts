import type { PackageOverrides, EntrypointConfig } from "./config.ts";

export async function generatePackageJson(
  packageDir: string,
  externalDeps: string[],
  entrypoint: string,
  entrypoints?: EntrypointConfig[],
  overrides?: PackageOverrides
) {
  console.log("\n📋 Generating package.json...");

  const originalPkg = await readOriginalPackageJson(packageDir);
  const denoJson = await readDenoJson(packageDir);
  const packageLock = await readPackageLock();
  const jsrDeps = await readJSRPackageDependencies(packageDir);
  const dependencies = buildDependencies(externalDeps, jsrDeps, packageLock);

  const newPkg = buildNewPackageJson(
    originalPkg,
    denoJson,
    dependencies,
    packageDir,
    entrypoint,
    entrypoints,
    overrides
  );
  
  await Deno.writeTextFile(
    `${packageDir}/dist/package.json`,
    JSON.stringify(newPkg, null, 2)
  );

  console.log(`✅ Generated package.json with ${Object.keys(dependencies).length} dependencies`);
}

async function readOriginalPackageJson(packageDir: string): Promise<Record<string, any>> {
  try {
    const content = await Deno.readTextFile(`${packageDir}/package.json`);
    console.log("✅ Found original package.json");
    return JSON.parse(content);
  } catch {
    console.warn("⚠️ Could not read original package.json, using defaults");
    return {
      name: "converted-jsr-package",
      version: "1.0.0",
      description: "Converted JSR package",
      license: "MIT",
    };
  }
}

async function readDenoJson(packageDir: string): Promise<Record<string, any>> {
  try {
    const content = await Deno.readTextFile(`${packageDir}/deno.json`);
    console.log("✅ Found deno.json");
    return JSON.parse(content);
  } catch {
    // Try deno.jsonc
    try {
      const content = await Deno.readTextFile(`${packageDir}/deno.jsonc`);
      console.log("✅ Found deno.jsonc");
      return JSON.parse(content);
    } catch {
      return {};
    }
  }
}

async function readPackageLock(): Promise<Record<string, any>> {
  try {
    const content = await Deno.readTextFile(`${Deno.cwd()}/package-lock.json`);
    return JSON.parse(content);
  } catch {
    console.warn("⚠️ Could not read package-lock.json");
    return {};
  }
}

async function readJSRPackageDependencies(packageDir: string): Promise<Record<string, string>> {
  const allDeps: Record<string, string> = {};
  
  // 读取主包的依赖
  try {
    const content = await Deno.readTextFile(`${packageDir}/package.json`);
    const pkg = JSON.parse(content);
    const deps = pkg.dependencies || {};
    Object.assign(allDeps, deps);
  } catch {
    // 主包没有 package.json
  }

  // 递归读取所有 JSR 依赖的依赖
  // packageDir 是 node_modules/@scope/package，我们需要读取同级的 node_modules/@jsr/
  try {
    const parts = packageDir.split("/");
    const nodeModulesIndex = parts.lastIndexOf("node_modules");
    if (nodeModulesIndex !== -1) {
      const rootNodeModules = parts.slice(0, nodeModulesIndex + 1).join("/");
      const jsrDir = `${rootNodeModules}/@jsr`;
      
      for await (const scopedEntry of Deno.readDir(jsrDir)) {
        if (scopedEntry.isDirectory) {
          const depPath = `${jsrDir}/${scopedEntry.name}`;
          
          try {
            const depPkgContent = await Deno.readTextFile(`${depPath}/package.json`);
            const depPkg = JSON.parse(depPkgContent);
            const depDeps = depPkg.dependencies || {};
            
            // 合并依赖，但不覆盖已存在的（优先使用主包的版本）
            for (const [name, version] of Object.entries(depDeps)) {
              if (!allDeps[name]) {
                allDeps[name] = version as string;
              }
            }
          } catch {
            // 无法读取依赖的 package.json，跳过
          }
        }
      }
    }
  } catch {
    // node_modules/@jsr 不存在或无法读取
  }

  return allDeps;
}

function buildDependencies(
  externalDeps: string[],
  jsrDeps: Record<string, string>,
  packageLock: Record<string, any>
): Record<string, string> {
  const dependencies: Record<string, string> = {};
  const packages = packageLock.packages || {};

  for (const dep of externalDeps) {
    if (dep.startsWith("node:")) continue;

    const packageName = extractPackageName(dep);
    if (dependencies[packageName]) continue;

    // 优先使用 JSR 包的直接依赖版本
    if (jsrDeps[packageName]) {
      dependencies[packageName] = jsrDeps[packageName];
      console.log(`  📌 ${packageName}: ${jsrDeps[packageName]} (from JSR package)`);
    } else {
      // 回退到从 package-lock.json 查找
      const version = findVersionInLock(packageName, packages);
      dependencies[packageName] = version;
      console.log(`  📌 ${packageName}: ${version}`);
    }
  }

  return dependencies;
}

function extractPackageName(dep: string): string {
  const parts = dep.split("/");
  
  if (dep.startsWith("@") && parts.length > 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  
  if (!dep.startsWith("@") && parts.length > 1) {
    return parts[0];
  }
  
  return dep;
}

function findVersionInLock(
  packageName: string,
  packages: Record<string, any>
): string {
  for (const [pkgPath, pkgInfo] of Object.entries(packages)) {
    const nodeModulesIndex = pkgPath.lastIndexOf("node_modules/");
    if (nodeModulesIndex === -1) continue;

    const afterNodeModules = pkgPath.substring(nodeModulesIndex + "node_modules/".length);
    const pathParts = afterNodeModules.split("/");

    const lockPackageName = pathParts[0]?.startsWith("@")
      ? `${pathParts[0]}/${pathParts[1]}`
      : pathParts[0];

    if (lockPackageName === packageName && pkgInfo.version) {
      return pkgInfo.version;
    }
  }

  return "latest";
}

function buildNewPackageJson(
  originalPkg: Record<string, any>,
  denoJson: Record<string, any>,
  dependencies: Record<string, string>,
  packageDir: string,
  entrypoint: string,
  entrypoints?: EntrypointConfig[],
  overrides?: PackageOverrides
): Record<string, any> {
  // Start with original package.json
  const newPkg = { ...originalPkg };

  // Merge metadata from deno.json (if not already in package.json)
  if (denoJson.name && !newPkg.name) {
    newPkg.name = denoJson.name;
  }
  if (denoJson.version && !newPkg.version) {
    newPkg.version = denoJson.version;
  }
  if (denoJson.description) {
    newPkg.description = denoJson.description;
  }
  if (denoJson.author) {
    newPkg.author = denoJson.author;
  }
  if (denoJson.license) {
    newPkg.license = denoJson.license;
  }
  if (denoJson.repository) {
    newPkg.repository = denoJson.repository;
  }
  if (denoJson.keywords) {
    newPkg.keywords = denoJson.keywords;
  }
  if (denoJson.homepage) {
    newPkg.homepage = denoJson.homepage;
  }

  // Remove old fields
  delete newPkg.main;
  delete newPkg.module;
  delete newPkg.types;
  delete newPkg.devDependencies;
  delete newPkg.scripts;
  delete newPkg.files;
  delete newPkg._jsr_revision;
  delete newPkg.dependencies;

  // Set new fields
  newPkg.type = "module";
  newPkg.dependencies = dependencies;

  // 处理多入口点或单入口点
  if (entrypoints && entrypoints.length > 0) {
    // 多入口点模式
    const mainEntry = entrypoints[0];
    newPkg.main = `./${mainEntry.output}`;
    newPkg.types = findTypesFile(packageDir, mainEntry.input);

    // 构建 exports
    const exports: Record<string, any> = {
      "./types/*": "./types/*",
    };

    // 主导出
    exports["."] = {
      import: `./${mainEntry.output}`,
      types: newPkg.types,
    };

    // 其他入口点
    for (let i = 1; i < entrypoints.length; i++) {
      const entry = entrypoints[i];
      const exportKey = `./${entry.output.replace(/\.m?js$/, "")}`;
      exports[exportKey] = {
        import: `./${entry.output}`,
      };
    }

    newPkg.exports = exports;

    // 处理 bin 字段
    const binEntries = entrypoints.filter(e => e.type === "bin");
    if (binEntries.length > 0) {
      newPkg.bin = {};
      for (const binEntry of binEntries) {
        // 优先使用配置的 binName，否则从 output 路径提取命令名
        let cmdName = binEntry.binName;
        if (!cmdName) {
          // 从 output 路径提取命令名（去掉目录前缀和 .mjs 后缀）
          cmdName = binEntry.output
            .split("/").pop()!  // 获取文件名
            .replace(/\.m?js$/, "");  // 去掉扩展名
        }
        newPkg.bin[cmdName] = `./${binEntry.output}`;
      }
    }

    // 脚本
    if (binEntries.length > 0) {
      newPkg.scripts = { start: `node ${binEntries[0].output}` };
    } else {
      newPkg.scripts = { start: `node ${mainEntry.output}` };
    }
  } else {
    // 单入口点模式（向后兼容）
    newPkg.main = "./bundle.mjs";
    newPkg.types = findTypesFile(packageDir, entrypoint);
    newPkg.scripts = { start: "node bundle.mjs" };

    // Set exports
    newPkg.exports = {
      ".": {
        import: "./bundle.mjs",
        types: newPkg.types,
      },
      "./types/*": "./types/*",
    };

    if (originalPkg.bin) {
      const newBin: Record<string, string> = {};
      for (const key of Object.keys(originalPkg.bin)) {
        newBin[key] = "./bundle.mjs";
      }
      newPkg.bin = newBin;
      newPkg.exports["./bin"] = "./bundle.mjs";
    }
  }

  // Rename package
  const originalName = originalPkg.name || "package";
  newPkg.name = "@jsr2npm/" + originalName.split("/").pop();

  // Apply config overrides
  if (overrides) {
    if (overrides.name) {
      newPkg.name = overrides.name;
      console.log(`  ✏️  Overriding name: ${overrides.name}`);
    }
    if (overrides.version) {
      newPkg.version = overrides.version;
      console.log(`  ✏️  Overriding version: ${overrides.version}`);
    }
    if (overrides.description) {
      newPkg.description = overrides.description;
      console.log(`  ✏️  Overriding description`);
    }
    if (overrides.license) {
      newPkg.license = overrides.license;
      console.log(`  ✏️  Overriding license: ${overrides.license}`);
    }
    if (overrides.author) {
      newPkg.author = overrides.author;
      console.log(`  ✏️  Overriding author`);
    }
    if (overrides.repository) {
      newPkg.repository = overrides.repository;
      console.log(`  ✏️  Overriding repository`);
    }
    if (overrides.homepage) {
      newPkg.homepage = overrides.homepage;
      console.log(`  ✏️  Overriding homepage: ${overrides.homepage}`);
    }
    if (overrides.keywords) {
      newPkg.keywords = overrides.keywords;
      console.log(`  ✏️  Overriding keywords (${overrides.keywords.length} items)`);
    }
    if (overrides.bin) {
      newPkg.bin = overrides.bin;
      console.log(`  ✏️  Overriding bin commands`);
    }
    if (overrides.scripts) {
      newPkg.scripts = { ...newPkg.scripts, ...overrides.scripts };
      console.log(`  ✏️  Merging scripts`);
    }
  }

  return newPkg;
}

function findTypesFile(packageDir: string, entrypoint: string): string {
  const entrypointDts = entrypoint.replace(/\.(ts|js)$/, ".d.ts");
  
  try {
    Deno.statSync(`${packageDir}/dist/types/${entrypointDts}`);
    console.log(`  📝 Using types/${entrypointDts}`);
    return `./types/${entrypointDts}`;
  } catch {
    try {
      Deno.statSync(`${packageDir}/dist/types/mod.d.ts`);
      console.log("  📝 Using types/mod.d.ts");
      return "./types/mod.d.ts";
    } catch {
      console.log("  ⚠️ No .d.ts files found");
      return "./types/mod.d.ts";
    }
  }
}

export async function copyExtraFiles(sourceDir: string, targetDir: string) {
  console.log("\n📄 Copying extra files...");
  const files = ["README.md", "README", "LICENSE", "LICENSE.md"];

  for (const file of files) {
    try {
      await Deno.stat(`${sourceDir}/${file}`);
      await Deno.copyFile(`${sourceDir}/${file}`, `${targetDir}/${file}`);
      console.log(`  ✅ Copied ${file}`);
    } catch {
      // File doesn't exist
    }
  }
}
