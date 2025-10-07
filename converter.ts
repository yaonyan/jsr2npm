import $ from "dax-sh";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { bundleWithEsbuild, copyTypeDeclarations } from "./bundler.ts";
import { copyExtraFiles, generatePackageJson } from "./package-generator.ts";
import type { PackageOverrides } from "./config.ts";

export async function convertPackage(
  packageName: string,
  version: string,
  bin?: Record<string, string>,
  overrides?: PackageOverrides,
) {
  console.log(`\n📦 Package: ${packageName}`);
  console.log(`🏷️  Version: ${version}`);

  if (bin) {
    console.log(`🔧 CLI Commands: ${Object.keys(bin).join(", ")}`);
  }

  const workspaceDir = createWorkspace(packageName, version);
  const originalCwd = process.cwd();

  try {
    process.chdir(workspaceDir);
    await installJSRPackage(packageName, version);

    const packageDir = join("node_modules", packageName);
    await mkdir(join(packageDir, "dist"), { recursive: true });

    const externalPackages = await getExternalPackages(packageDir);
    await bundlePackage(packageDir, bin, externalPackages);

    await copyTypeDeclarations(packageDir);
    await copyExtraFiles(packageDir, `${packageDir}/dist`);
    await generatePackageJson(packageDir, bin, overrides);
    await moveDistToRoot(packageDir);

    console.log("\n✅ Conversion completed!");
    console.log(`📂 Output: ${workspaceDir}/dist`);
  } finally {
    process.chdir(originalCwd);
  }
}

function createWorkspace(packageName: string, version: string): string {
  const folderName = packageName.replace(/[@\/]/g, "__") + `_${version}`;
  mkdirSync(folderName, { recursive: true });
  console.log(`📁 Created folder: ${folderName}`);
  return folderName;
}

async function getExternalPackages(packageDir: string): Promise<string[]> {
  try {
    const content = await readFile(join(packageDir, "package.json"), "utf-8");
    const pkgJson = JSON.parse(content);

    if (!pkgJson.dependencies) return [];

    const topLevelDeps: Record<string, string> = {};
    for (const [name, version] of Object.entries(pkgJson.dependencies)) {
      if (!name.startsWith("@jsr/")) {
        topLevelDeps[name] = String(version);
      }
    }

    const jsrPackages = Object.keys(pkgJson.dependencies).filter((name) =>
      name.startsWith("@jsr/")
    );
    const conflictingPackages = await findConflictingPackages(
      packageDir,
      jsrPackages,
      topLevelDeps,
    );

    const externals = Object.keys(topLevelDeps).filter((name) =>
      !conflictingPackages.has(name)
    );

    const externalList = externals.join(", ") || "none";
    console.log(
      `\n📦 External dependencies (${externals.length}): ${externalList}`,
    );

    if (conflictingPackages.size > 0) {
      const conflictList = Array.from(conflictingPackages).join(", ");
      console.log(`⚠️  Version conflicts, will bundle: ${conflictList}`);
    }

    return externals;
  } catch {
    return [];
  }
}

async function findConflictingPackages(
  packageDir: string,
  jsrPackages: string[],
  topLevelDeps: Record<string, string>,
): Promise<Set<string>> {
  const conflicts = new Set<string>();

  for (const jsrPkg of jsrPackages) {
    try {
      const jsrPkgPath = join(
        packageDir,
        "node_modules",
        jsrPkg,
        "package.json",
      );
      const jsrContent = await readFile(jsrPkgPath, "utf-8");
      const jsrPkgJson = JSON.parse(jsrContent);

      if (!jsrPkgJson.dependencies) continue;

      for (
        const [depName, depVersion] of Object.entries(jsrPkgJson.dependencies)
      ) {
        if (depName.startsWith("@jsr/")) continue;

        if (topLevelDeps[depName]) {
          if (topLevelDeps[depName] !== depVersion) {
            conflicts.add(depName);
            console.log(`  ⚠️  Version conflict for ${depName}:`);
            console.log(`      Top-level: ${topLevelDeps[depName]}`);
            console.log(`      ${jsrPkg}: ${depVersion}`);
          }
        }
      }
    } catch {
      continue;
    }
  }

  return conflicts;
}

async function bundlePackage(
  packageDir: string,
  bin: Record<string, string> | undefined,
  externalPackages: string[],
) {
  if (bin) {
    await bundleBinCommands(packageDir, bin, externalPackages);
  } else {
    await bundleLibraryExports(packageDir, externalPackages);
  }
}

async function bundleBinCommands(
  packageDir: string,
  bin: Record<string, string>,
  externalPackages: string[],
) {
  console.log("\n🔨 Bundling CLI tools...");

  for (const [cmdName, inputFile] of Object.entries(bin)) {
    await verifyEntrypoint(packageDir, inputFile);

    const outputFile = `bin/${cmdName}.mjs`;
    await bundleWithEsbuild(
      packageDir,
      inputFile,
      outputFile,
      externalPackages,
    );

    const outputPath = join(packageDir, "dist", outputFile);
    await chmod(outputPath, 0o755);

    console.log(`  ✅ Created ${cmdName}: ${outputFile}`);
  }
}

async function bundleLibraryExports(
  packageDir: string,
  externalPackages: string[],
) {
  const exports = await readDenoJsonExports(packageDir);
  if (!exports) return;

  console.log("\n🔨 Bundling library exports...");

  for (const [exportKey, inputFile] of Object.entries(exports)) {
    await verifyEntrypoint(packageDir, inputFile);

    const outputFile = exportKey === "."
      ? "index.mjs"
      : `${exportKey.replace(/^\.\//, "")}.mjs`;

    await bundleWithEsbuild(
      packageDir,
      inputFile,
      outputFile,
      externalPackages,
    );
    console.log(`  ✅ Bundled ${exportKey}: ${outputFile}`);
  }
}

async function installJSRPackage(packageName: string, version: string) {
  await writeFile("package.json", "{}");

  const packageSpec = version === "latest"
    ? packageName
    : `${packageName}@${version}`;
  console.log(`🔄 Installing: ${packageSpec}`);

  await $`npx jsr add ${packageSpec}`.cwd(process.cwd());
}

async function verifyEntrypoint(packageDir: string, entrypoint: string) {
  try {
    await stat(join(packageDir, entrypoint));
    console.log(`✅ Found ${entrypoint}`);
  } catch {
    throw new Error(`❌ ${entrypoint} not found in ${packageDir}`);
  }
}

async function readDenoJsonExports(
  packageDir: string,
): Promise<Record<string, string> | null> {
  for (const file of ["deno.json", "deno.jsonc"]) {
    try {
      const content = await readFile(join(packageDir, file), "utf-8");
      const denoJson = JSON.parse(content);

      if (!denoJson.exports) continue;

      const exports: Record<string, string> = {};
      for (const [key, value] of Object.entries(denoJson.exports)) {
        const path = typeof value === "string" ? value : null;
        if (path?.endsWith(".ts")) {
          exports[key] = path;
        }
      }

      return Object.keys(exports).length > 0 ? exports : null;
    } catch {
      continue;
    }
  }

  return null;
}

async function moveDistToRoot(packageDir: string) {
  const sourceDist = join(packageDir, "dist");
  const targetDist = join(process.cwd(), "dist");

  try {
    await rm(targetDist, { recursive: true });
  } catch {
    // Target doesn't exist, ignore
  }

  await rename(sourceDist, targetDist);
  await copyExtraFiles(packageDir, targetDist);
}
