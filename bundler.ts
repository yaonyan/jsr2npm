import { mkdir, copyFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export async function bundleWithEsbuild(
  packageDir: string,
  inputFile: string,
  outputFile: string,
  externalPackages: string[] = [],
): Promise<void> {
  const { build } = await import("npm:esbuild@0.25.5");

  const entryPath = join(process.cwd(), packageDir, inputFile);
  const outputPath = join(process.cwd(), packageDir, "dist", outputFile);
  const outputDir = outputPath.split("/").slice(0, -1).join("/");

  await mkdir(outputDir, { recursive: true });

  const externalList = externalPackages.length > 0
    ? externalPackages.join(", ")
    : "none";
  console.log(`  📦 External packages: ${externalList}`);

  await build({
    entryPoints: [entryPath],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: outputPath,
    external: externalPackages,
    packages: "bundle",
    banner: {
      js: `#!/usr/bin/env node
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);`,
    },
    write: true,
  });
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
