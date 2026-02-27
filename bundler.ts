import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";

export async function bundleWithEsbuild(
  packageDir: string,
  inputFile: string,
  outputFile: string,
  externalPackages: string[] = [],
  useBrowserPlatform: boolean = false,
  isBin: boolean = false,
): Promise<void> {
  const entryPath = join(process.cwd(), packageDir, inputFile);
  const baseName = outputFile.replace(/\.mjs$/, "");
  const esmOutputPath = join(
    process.cwd(),
    packageDir,
    "dist",
    `${baseName}.mjs`,
  );
  const cjsOutputPath = join(
    process.cwd(),
    packageDir,
    "dist",
    `${baseName}.cjs`,
  );
  const outputDir = esmOutputPath.split("/").slice(0, -1).join("/");

  await mkdir(outputDir, { recursive: true });

  const externalList = externalPackages.length > 0
    ? externalPackages.join(", ")
    : "none";
  console.log(`  📦 External packages: ${externalList}`);

  const platform = useBrowserPlatform ? "neutral" : "node";

  // Browser platform: no banner needed
  // Node platform: add createRequire for ESM compatibility
  // Bin files also need shebang for direct execution
  const esmBanner = useBrowserPlatform
    ? ({} as Record<string, string>)
    : isBin
    ? {
      js: `#!/usr/bin/env node
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);`,
    }
    : {
      js: `import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);`,
    };
  // CJS doesn't need createRequire, only shebang for bin files
  const cjsBanner = !isBin ? ({} as Record<string, string>) : {
    js: `#!/usr/bin/env node`,
  };

  console.log(
    `  🔧 Platform: ${platform}${useBrowserPlatform ? " (browser)" : ""}`,
  );

  // Build ESM
  await build({
    entryPoints: [entryPath],
    bundle: true,
    platform,
    format: "esm",
    outfile: esmOutputPath,
    external: externalPackages,
    packages: "bundle",
    banner: esmBanner,
    write: true,
  });

  // Build CommonJS
  await build({
    entryPoints: [entryPath],
    bundle: true,
    platform,
    format: "cjs",
    outfile: cjsOutputPath,
    external: externalPackages,
    packages: "bundle",
    banner: cjsBanner,
    write: true,
  });

  console.log(`  ✅ Built ESM: ${baseName}.mjs`);
  console.log(`  ✅ Built CJS: ${baseName}.cjs`);
}

export async function copyTypeDeclarations(packageDir: string) {
  console.log("\n📝 Copying TypeScript declarations...");

  const sourceDir = join(packageDir, "_dist");
  const targetDir = join(packageDir, "dist", "types");

  try {
    await stat(sourceDir);
    await mkdir(targetDir, { recursive: true });

    const entries = await readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
      const source = join(sourceDir, entry.name);
      const target = join(targetDir, entry.name);

      if (entry.isFile()) {
        await copyFile(source, target);
      } else if (entry.isDirectory()) {
        await copyDirectory(source, target);
      }

      console.log(`  ✅ Copied ${entry.name}`);
    }

    console.log("✅ TypeScript declarations copied");
  } catch {
    console.warn("⚠️ No TypeScript declarations found");
  }
}

async function copyDirectory(source: string, target: string) {
  await mkdir(target, { recursive: true });

  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);

    if (entry.isFile()) {
      await copyFile(sourcePath, targetPath);
    } else if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    }
  }
}
