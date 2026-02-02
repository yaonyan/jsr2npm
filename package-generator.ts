import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { PackageOverrides } from "./config.ts";

type PackageJson = Record<string, unknown>;

export async function generatePackageJson(
  packageDir: string,
  bin?: Record<string, string>,
  overrides?: PackageOverrides,
  allDependencies?: Record<string, string>,
) {
  console.log("\n📋 Generating package.json...");

  const jsrPkg = await readPackageJson(`${packageDir}/package.json`);
  const denoJson = await readDenoJson(packageDir);

  // Use allDependencies if provided, otherwise extract from jsrPkg
  const dependencies = allDependencies ||
    getNpmDependencies(jsrPkg.dependencies);

  const newPkg = buildPackageJson(
    jsrPkg,
    denoJson,
    dependencies,
    bin,
    overrides,
  );

  await writeFile(
    join(packageDir, "dist", "package.json"),
    JSON.stringify(newPkg, null, 2),
  );

  console.log(
    `✅ Generated package.json with ${
      Object.keys(dependencies).length
    } dependencies`,
  );
}

async function readPackageJson(path: string): Promise<PackageJson> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content);
  } catch {
    return { name: "converted-package", version: "1.0.0", license: "MIT" };
  }
}

async function readDenoJson(packageDir: string): Promise<PackageJson> {
  for (const file of ["deno.json", "deno.jsonc"]) {
    try {
      const content = await readFile(join(packageDir, file), "utf-8");
      console.log(`✅ Found ${file}`);
      return JSON.parse(content);
    } catch {
      continue;
    }
  }
  return {};
}

function getNpmDependencies(deps: unknown): Record<string, string> {
  if (!deps || typeof deps !== "object") return {};

  const npmDeps: Record<string, string> = {};
  for (const [name, version] of Object.entries(deps)) {
    if (!name.startsWith("@jsr/")) {
      npmDeps[name] = String(version);
      console.log(`  📌 ${name}: ${version}`);
    }
  }
  return npmDeps;
}

function buildPackageJson(
  jsrPkg: PackageJson,
  denoJson: PackageJson,
  dependencies: Record<string, string>,
  bin?: Record<string, string>,
  overrides?: PackageOverrides,
): PackageJson {
  const pkg: PackageJson = {
    ...jsrPkg,
    dependencies,
  };

  // Remove type: module to support dual ESM/CJS
  delete pkg.type;

  mergeMetadata(pkg, denoJson);
  addBugsUrl(pkg);

  delete pkg._jsr_revision;
  delete pkg.devDependencies;

  buildExports(pkg, denoJson, bin);

  const originalName = String(jsrPkg.name || "package");
  pkg.name = `@jsr2npm/${originalName.split("/").pop()}`;

  applyOverrides(pkg, overrides);

  return pkg;
}

function mergeMetadata(pkg: PackageJson, denoJson: PackageJson) {
  const fields = ["description", "author", "license", "repository", "keywords"];

  for (const field of fields) {
    if (denoJson[field] && !pkg[field]) {
      pkg[field] = denoJson[field];
      const extra = field === "keywords"
        ? ` (${(denoJson[field] as string[]).length} items)`
        : "";
      console.log(`  📝 Using ${field} from deno.json${extra}`);
    }
  }
}

function addBugsUrl(pkg: PackageJson) {
  if (!pkg.repository || pkg.bugs) return;

  const repoUrl = typeof pkg.repository === "string"
    ? pkg.repository
    : (pkg.repository as { url?: string })?.url;

  if (!repoUrl) return;

  const cleanUrl = repoUrl.replace(/^git\+/, "").replace(/\.git$/, "");
  pkg.bugs = { url: `${cleanUrl}/issues` };
  console.log(`  🐛 Added bugs URL`);
}

function buildExports(
  pkg: PackageJson,
  denoJson: PackageJson,
  bin?: Record<string, string>,
) {
  const hasLibraryExports = !!denoJson.exports;
  const hasBinExports = bin && Object.keys(bin).length > 0;

  if (hasLibraryExports) {
    buildLibraryExports(pkg, denoJson);
  }

  if (hasBinExports) {
    buildBinExports(pkg, bin);
  }

  if (!hasLibraryExports && !hasBinExports) {
    pkg.exports = { "./types/*": "./types/*" };
    console.log(`  ⚠️  No exports found, only exposing types`);
  }
}

function buildBinExports(pkg: PackageJson, bin: Record<string, string>) {
  const binCommands: Record<string, string> = {};

  // Get existing exports or create new
  const exports = (pkg.exports as Record<string, unknown>) || {};

  for (const cmdName of Object.keys(bin)) {
    // Use .mjs for bin commands (ESM with shebang)
    binCommands[cmdName] = `./bin/${cmdName}.mjs`;
    exports[`./bin/${cmdName}`] = {
      import: `./bin/${cmdName}.mjs`,
      require: `./bin/${cmdName}.cjs`,
    };
  }

  pkg.bin = binCommands;
  pkg.exports = exports;

  // Only set main/module if not already set by library exports
  if (!pkg.main) {
    const firstCmd = Object.keys(bin)[0];
    pkg.main = `./bin/${firstCmd}.cjs`;
    pkg.module = `./bin/${firstCmd}.mjs`;
  }

  console.log(
    `  🔧 Added bin commands: ${Object.keys(binCommands).join(", ")}`,
  );
}

function buildLibraryExports(pkg: PackageJson, denoJson: PackageJson) {
  const exports: Record<string, unknown> = {};
  const denoExports = denoJson.exports as Record<string, unknown>;

  for (const [key, value] of Object.entries(denoExports)) {
    const tsPath = typeof value === "string" ? value : null;
    if (!tsPath) continue;

    const baseName = key === "." ? "index" : key.replace(/^\.\//, "");
    const dtsFile = tsPath.replace(/\.ts$/, ".d.ts").replace(/^\.\//, "");

    exports[key] = {
      types: `./types/${dtsFile}`,
      import: `./${baseName}.mjs`,
      require: `./${baseName}.cjs`,
    };
  }

  exports["./types/*"] = "./types/*";
  pkg.exports = exports;

  const mainExport = exports["."] as
    | { import: string; require: string }
    | undefined;
  if (mainExport) {
    pkg.main = mainExport.require;
    pkg.module = mainExport.import;
  }

  console.log(
    `  📦 Built exports for ${
      Object.keys(denoExports).length
    } entry points (ESM + CJS)`,
  );
}

function applyOverrides(pkg: PackageJson, overrides?: PackageOverrides) {
  if (!overrides) return;

  const fields = [
    "name",
    "version",
    "description",
    "license",
    "author",
    "repository",
    "homepage",
    "publishConfig",
  ];

  for (const field of fields) {
    const value = overrides[field as keyof PackageOverrides];
    if (value) {
      pkg[field] = value;
      console.log(`  ✏️  Overriding ${field}`);
    }
  }

  if (overrides.keywords) {
    pkg.keywords = overrides.keywords;
    console.log(
      `  ✏️  Overriding keywords (${overrides.keywords.length} items)`,
    );
  }

  if (overrides.scripts) {
    const existingScripts = (pkg.scripts as Record<string, string>) || {};
    pkg.scripts = { ...existingScripts, ...overrides.scripts };
    console.log(`  ✏️  Merging scripts`);
  }
}

export async function copyExtraFiles(
  sourceDir: string,
  targetDir: string,
  extraFiles?: string[],
) {
  console.log("\n📄 Copying extra files...");

  const files = ["README.md", "README", "LICENSE", "LICENSE.md"];

  for (const file of files) {
    try {
      await stat(join(sourceDir, file));
      await copyFile(join(sourceDir, file), join(targetDir, file));
      console.log(`  ✅ Copied ${file}`);
    } catch {
      // File doesn't exist, skip
    }
  }

  if (extraFiles && extraFiles.length > 0) {
    for (const pattern of extraFiles) {
      await copyGlobPattern(sourceDir, targetDir, pattern);
    }
  }
}

async function copyGlobPattern(
  sourceDir: string,
  targetDir: string,
  pattern: string,
) {
  if (pattern.includes("**")) {
    const [prefix] = pattern.split("**");
    const suffix = pattern.split("**").pop() || "";
    const ext = suffix.replace(/^\/?\*/, "");
    const searchDir = join(sourceDir, prefix);

    try {
      await copyMatchingFiles(searchDir, sourceDir, targetDir, ext);
    } catch {
      console.log(`  ⚠️  Pattern ${pattern} matched no files`);
    }
  } else {
    try {
      const srcPath = join(sourceDir, pattern);
      const destPath = join(targetDir, pattern);
      const srcStat = await stat(srcPath);

      if (srcStat.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await mkdir(dirname(destPath), { recursive: true });
        await copyFile(srcPath, destPath);
      }
      console.log(`  ✅ Copied ${pattern}`);
    } catch {
      console.log(`  ⚠️  File ${pattern} not found`);
    }
  }
}

async function copyMatchingFiles(
  dir: string,
  sourceRoot: string,
  targetRoot: string,
  ext: string,
) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await copyMatchingFiles(fullPath, sourceRoot, targetRoot, ext);
    } else if (entry.name.endsWith(ext)) {
      const relativePath = relative(sourceRoot, fullPath);
      const destPath = join(targetRoot, relativePath);
      await mkdir(dirname(destPath), { recursive: true });
      await copyFile(fullPath, destPath);
      console.log(`  ✅ Copied ${relativePath}`);
    }
  }
}

async function copyDir(src: string, dest: string) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}
