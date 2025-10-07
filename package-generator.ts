import { copyFile, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PackageOverrides } from "./config.ts";

type PackageJson = Record<string, unknown>;

export async function generatePackageJson(
  packageDir: string,
  bin?: Record<string, string>,
  overrides?: PackageOverrides,
) {
  console.log("\n📋 Generating package.json...");

  const jsrPkg = await readPackageJson(`${packageDir}/package.json`);
  const denoJson = await readDenoJson(packageDir);
  const dependencies = getNpmDependencies(jsrPkg.dependencies);
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
    type: "module",
    dependencies,
  };

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
  if (bin && Object.keys(bin).length > 0) {
    buildBinExports(pkg, bin);
  } else if (denoJson.exports) {
    buildLibraryExports(pkg, denoJson);
  } else {
    pkg.exports = { "./types/*": "./types/*" };
    console.log(`  ⚠️  No exports found, only exposing types`);
  }
}

function buildBinExports(pkg: PackageJson, bin: Record<string, string>) {
  const binCommands: Record<string, string> = {};
  const exports: Record<string, unknown> = {};

  for (const cmdName of Object.keys(bin)) {
    binCommands[cmdName] = `./bin/${cmdName}.mjs`;
    exports[`./bin/${cmdName}`] = `./bin/${cmdName}.mjs`;
  }

  pkg.bin = binCommands;
  const firstCmd = Object.keys(bin)[0];
  exports["."] = `./bin/${firstCmd}.mjs`;
  pkg.exports = exports;
  pkg.main = `./bin/${firstCmd}.mjs`;

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

    const mjsFile = key === "."
      ? "index.mjs"
      : `${key.replace(/^\.\//, "")}.mjs`;
    const dtsFile = tsPath.replace(/\.ts$/, ".d.ts").replace(/^\.\//, "");

    exports[key] = {
      types: `./types/${dtsFile}`,
      import: `./${mjsFile}`,
    };
  }

  exports["./types/*"] = "./types/*";
  pkg.exports = exports;

  const mainExport = exports["."];
  if (mainExport && typeof mainExport === "object" && "import" in mainExport) {
    pkg.main = mainExport.import as string;
  }

  console.log(
    `  📦 Built exports for ${Object.keys(denoExports).length} entry points`,
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

export async function copyExtraFiles(sourceDir: string, targetDir: string) {
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
}
