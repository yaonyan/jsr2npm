import type { PackageOverrides } from "./config.ts";

type PackageJson = Record<string, unknown>;

export async function generatePackageJson(
  packageDir: string,
  bin?: Record<string, string>,
  overrides?: PackageOverrides
) {
  console.log("\n📋 Generating package.json...");

  // Read JSR's package.json
  const jsrPkg = await readPackageJson(`${packageDir}/package.json`);
  
  // Filter out @jsr/* dependencies
  const npmDeps = filterJsrDependencies(jsrPkg.dependencies);
  
  // Build new package.json
  const newPkg = buildPackageJson(jsrPkg, npmDeps, bin, overrides);
  
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
  bin?: Record<string, string>,
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

  // Add bin commands if configured
  if (bin && Object.keys(bin).length > 0) {
    const binCommands: Record<string, string> = {};
    for (const cmdName of Object.keys(bin)) {
      binCommands[cmdName] = `./bin/${cmdName}.mjs`;
    }
    pkg.bin = binCommands;
    console.log(`  🔧 Added bin commands: ${Object.keys(binCommands).join(", ")}`);
  }

  // Rename package
  const originalName = String(jsrPkg.name || "package");
  const shortName = originalName.split("/").pop() || "package";
  pkg.name = `@jsr2npm/${shortName}`;

  // Apply overrides
  applyOverrides(pkg, overrides);

  return pkg;
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
