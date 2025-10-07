import type { PackageOverrides, EntrypointConfig } from "./config.ts";

type PackageJson = Record<string, unknown>;

export async function generatePackageJson(
  packageDir: string,
  _externalDeps: string[],
  entrypoint: string,
  entrypoints?: EntrypointConfig[],
  overrides?: PackageOverrides
) {
  console.log("\n📋 Generating package.json...");

  // Read JSR's package.json
  const jsrPkg = await readPackageJson(`${packageDir}/package.json`);
  
  // Filter out @jsr/* dependencies
  const npmDeps = filterJsrDependencies(jsrPkg.dependencies);
  
  // Build new package.json
  const newPkg = buildPackageJson(jsrPkg, npmDeps, packageDir, entrypoint, entrypoints, overrides);
  
  // Write to dist
  await Deno.writeTextFile(
    `${packageDir}/dist/package.json`,
    JSON.stringify(newPkg, null, 2)
  );

  console.log(`✅ Generated package.json with ${Object.keys(npmDeps).length} dependencies`);
}

async function readPackageJson(path: string): Promise<PackageJson> {
  try {
    const content = await Deno.readTextFile(path);
    return JSON.parse(content);
  } catch {
    return {
      name: "converted-package",
      version: "1.0.0",
      license: "MIT",
    };
  }
}

function filterJsrDependencies(deps: unknown): Record<string, string> {
  if (!deps || typeof deps !== "object") return {};
  
  const filtered: Record<string, string> = {};
  for (const [name, version] of Object.entries(deps)) {
    if (!name.startsWith("@jsr/")) {
      filtered[name] = String(version);
      console.log(`  📌 ${name}: ${version}`);
    }
  }
  return filtered;
}

function buildPackageJson(
  jsrPkg: PackageJson,
  dependencies: Record<string, string>,
  packageDir: string,
  entrypoint: string,
  entrypoints?: EntrypointConfig[],
  overrides?: PackageOverrides
): PackageJson {
  // Keep all JSR metadata, just update what's needed
  const pkg: PackageJson = {
    ...jsrPkg,
    type: "module",
    dependencies,
  };

  // Clean up JSR-specific fields
  delete pkg._jsr_revision;
  delete pkg.devDependencies;

  // Handle entrypoints
  if (entrypoints && entrypoints.length > 0) {
    setupMultipleEntrypoints(pkg, packageDir, entrypoints);
  } else {
    setupSingleEntrypoint(pkg, packageDir, entrypoint, jsrPkg.bin);
  }

  // Rename package
  const originalName = String(jsrPkg.name || "package");
  const shortName = originalName.split("/").pop() || "package";
  pkg.name = `@jsr2npm/${shortName}`;

  // Apply overrides
  applyOverrides(pkg, overrides);

  return pkg;
}

function setupMultipleEntrypoints(
  pkg: PackageJson,
  packageDir: string,
  entrypoints: EntrypointConfig[]
) {
  const mainEntry = entrypoints[0];
  pkg.main = `./${mainEntry.output}`;
  pkg.types = findTypesFile(packageDir, mainEntry.input);

  // Build exports
  const exports: Record<string, unknown> = {
    "./types/*": "./types/*",
    ".": {
      import: `./${mainEntry.output}`,
      types: pkg.types,
    },
  };

  // Add other entrypoints
  for (let i = 1; i < entrypoints.length; i++) {
    const entry = entrypoints[i];
    const key = `./${entry.output.replace(/\.m?js$/, "")}`;
    exports[key] = { import: `./${entry.output}` };
  }

  pkg.exports = exports;

  // Handle bin entries
  const binEntries = entrypoints.filter(e => e.type === "bin");
  if (binEntries.length > 0) {
    const bin: Record<string, string> = {};
    for (const entry of binEntries) {
      const name = entry.binName || entry.output.split("/").pop()?.replace(/\.m?js$/, "") || "cli";
      bin[name] = `./${entry.output}`;
    }
    pkg.bin = bin;
    pkg.scripts = { start: `node ${binEntries[0].output}` };
  } else {
    pkg.scripts = { start: `node ${mainEntry.output}` };
  }
}

function setupSingleEntrypoint(
  pkg: PackageJson,
  packageDir: string,
  entrypoint: string,
  originalBin: unknown
) {
  pkg.main = "./bundle.mjs";
  pkg.types = findTypesFile(packageDir, entrypoint);
  pkg.scripts = { start: "node bundle.mjs" };
  pkg.exports = {
    ".": {
      import: "./bundle.mjs",
      types: pkg.types,
    },
    "./types/*": "./types/*",
  };

  // Handle bin if it exists in original
  if (originalBin && typeof originalBin === "object") {
    const bin: Record<string, string> = {};
    for (const key of Object.keys(originalBin)) {
      bin[key] = "./bundle.mjs";
    }
    pkg.bin = bin;
    (pkg.exports as Record<string, unknown>)["./bin"] = "./bundle.mjs";
  }
}

function findTypesFile(packageDir: string, entrypoint: string): string {
  const dts = entrypoint.replace(/\.(ts|js)$/, ".d.ts");
  
  try {
    Deno.statSync(`${packageDir}/dist/types/${dts}`);
    console.log(`  📝 Using types/${dts}`);
    return `./types/${dts}`;
  } catch {
    console.log("  📝 Using types/mod.d.ts");
    return "./types/mod.d.ts";
  }
}

function applyOverrides(pkg: PackageJson, overrides?: PackageOverrides) {
  if (!overrides) return;

  if (overrides.name) {
    pkg.name = overrides.name;
    console.log(`  ✏️  Overriding name: ${overrides.name}`);
  }
  if (overrides.version) {
    pkg.version = overrides.version;
    console.log(`  ✏️  Overriding version: ${overrides.version}`);
  }
  if (overrides.description) {
    pkg.description = overrides.description;
    console.log(`  ✏️  Overriding description`);
  }
  if (overrides.license) {
    pkg.license = overrides.license;
    console.log(`  ✏️  Overriding license: ${overrides.license}`);
  }
  if (overrides.author) {
    pkg.author = overrides.author;
    console.log(`  ✏️  Overriding author`);
  }
  if (overrides.repository) {
    pkg.repository = overrides.repository;
    console.log(`  ✏️  Overriding repository`);
  }
  if (overrides.homepage) {
    pkg.homepage = overrides.homepage;
    console.log(`  ✏️  Overriding homepage: ${overrides.homepage}`);
  }
  if (overrides.keywords) {
    pkg.keywords = overrides.keywords;
    console.log(`  ✏️  Overriding keywords (${overrides.keywords.length} items)`);
  }
  if (overrides.bin) {
    pkg.bin = overrides.bin;
    console.log(`  ✏️  Overriding bin commands`);
  }
  if (overrides.scripts) {
    const currentScripts = (pkg.scripts as Record<string, string>) || {};
    pkg.scripts = { ...currentScripts, ...overrides.scripts };
    console.log(`  ✏️  Merging scripts`);
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
