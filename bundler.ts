import type { EntrypointConfig } from "./config.ts";

export interface BundleResult {
  output: string;
}

/**
 * Bundle single entrypoint (backwards compatible)
 */
export async function bundlePackage(packageDir: string, entrypoint: string): Promise<string[]> {
  await bundleMultipleEntrypoints(packageDir, [
    { input: entrypoint, output: "bundle.mjs", type: "bin" }
  ]);
  return []; // No longer needed, deps are read from package.json
}

/**
 * Bundle multiple entrypoints
 */
export async function bundleMultipleEntrypoints(
  packageDir: string,
  entrypoints: EntrypointConfig[]
): Promise<BundleResult[]> {
  console.log("\n🔨 Bundling with esbuild...");
  const { build } = await import("npm:esbuild@0.25.5");

  const results: BundleResult[] = [];

  for (const entry of entrypoints) {
    console.log(`\n📄 Bundling: ${entry.input} → ${entry.output}`);
    const entryPath = `${Deno.cwd()}/${packageDir}/${entry.input}`;
    const outputPath = `${Deno.cwd()}/${packageDir}/dist/${entry.output}`;

    // Ensure output directory exists
    const outputDir = outputPath.split("/").slice(0, -1).join("/");
    await Deno.mkdir(outputDir, { recursive: true });

    const isBin = entry.type === "bin";

    await build({
      entryPoints: [entryPath],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: outputPath,
      banner: isBin ? { js: "#!/usr/bin/env node" } : undefined,
      plugins: [{
        name: "jsr-only",
        // deno-lint-ignore no-explicit-any
        setup(build: any) {
          build.onResolve({ filter: /.*/ }, (args: { path: string; importer?: string }) => {
            if (!args.importer) return null;
            
            // Bundle JSR dependencies
            if (args.path.startsWith("@jsr/") || args.path.startsWith("jsr:")) {
              return null;
            }

            // Bundle relative imports
            if (args.path.startsWith(".") || args.path.startsWith("/")) {
              return null;
            }

            // Mark node: and npm packages as external
            return { path: args.path, external: true };
          });
        },
      }],
      write: true,
    });

    console.log(`  ✅ Created ${entry.output}`);

    // Set executable permission for bin files
    if (isBin) {
      await makeExecutable(outputPath);
    }

    results.push({
      output: entry.output,
    });
  }

  // Copy type declarations for the first entrypoint
  await copyTypeDeclarations(packageDir, entrypoints[0].input);

  console.log(`\n✅ Bundled ${results.length} entrypoint(s)`);

  return results;
}

async function makeExecutable(bundlePath: string) {
  try {
    const content = await Deno.readTextFile(bundlePath);
    if (content.startsWith("#!/usr/bin/env node")) {
      const fileInfo = await Deno.stat(bundlePath);
      await Deno.chmod(bundlePath, (fileInfo.mode || 0o644) | 0o111);
      console.log("✅ Made bundle executable");
    }
  } catch (error) {
    console.warn("⚠️ Could not make bundle executable:", error);
  }
}

async function copyTypeDeclarations(packageDir: string, _entrypoint: string) {
  console.log("📝 Copying TypeScript declarations...");

  try {
    const distDirPath = `${packageDir}/_dist`;
    await Deno.stat(distDirPath);
    
    const typesDir = `${packageDir}/dist/types`;
    await Deno.mkdir(typesDir, { recursive: true });

    for await (const entry of Deno.readDir(distDirPath)) {
      const sourcePath = `${distDirPath}/${entry.name}`;
      const targetPath = `${typesDir}/${entry.name}`;

      if (entry.isFile) {
        await Deno.copyFile(sourcePath, targetPath);
        console.log(`  ✅ Copied ${entry.name}`);
      } else if (entry.isDirectory) {
        await Deno.mkdir(targetPath, { recursive: true });
        for await (const subEntry of Deno.readDir(sourcePath)) {
          if (subEntry.isFile) {
            await Deno.copyFile(
              `${sourcePath}/${subEntry.name}`,
              `${targetPath}/${subEntry.name}`
            );
          }
        }
        console.log(`  ✅ Copied directory ${entry.name}`);
      }
    }

    console.log("✅ TypeScript declarations copied");
  } catch (error) {
    console.warn("⚠️ Failed to copy declarations:", error);
  }
}
