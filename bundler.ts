/**
 * Bundle a single file with esbuild
 */
export async function bundleWithEsbuild(
  packageDir: string,
  inputFile: string,
  outputFile: string
): Promise<void> {
  const { build } = await import("npm:esbuild@0.25.5");

  const entryPath = `${Deno.cwd()}/${packageDir}/${inputFile}`;
  const outputPath = `${Deno.cwd()}/${packageDir}/dist/${outputFile}`;

  // Ensure output directory exists
  const outputDir = outputPath.split("/").slice(0, -1).join("/");
  await Deno.mkdir(outputDir, { recursive: true });

  await build({
    entryPoints: [entryPath],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: outputPath,
    banner: { js: "#!/usr/bin/env node" },
    plugins: [{
      name: "jsr-external",
      // deno-lint-ignore no-explicit-any
      setup(build: any) {
        build.onResolve({ filter: /.*/ }, (args: { path: string; importer?: string }) => {
          if (!args.importer) return null;
          
          // Bundle JSR dependencies and relative imports
          if (
            args.path.startsWith("@jsr/") ||
            args.path.startsWith("jsr:") ||
            args.path.startsWith(".") ||
            args.path.startsWith("/")
          ) {
            return null;
          }

          // Mark node: and npm packages as external
          return { path: args.path, external: true };
        });
      },
    }],
    write: true,
  });
}

/**
 * Copy TypeScript declarations from JSR package
 */
export async function copyTypeDeclarations(packageDir: string) {
  console.log("\n📝 Copying TypeScript declarations...");

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
        await copyDirectory(sourcePath, targetPath);
        console.log(`  ✅ Copied directory ${entry.name}`);
      }
    }

    console.log("✅ TypeScript declarations copied");
  } catch (error) {
    console.warn("⚠️ No TypeScript declarations found");
  }
}

async function copyDirectory(source: string, target: string) {
  await Deno.mkdir(target, { recursive: true });
  for await (const entry of Deno.readDir(source)) {
    const sourcePath = `${source}/${entry.name}`;
    const targetPath = `${target}/${entry.name}`;
    
    if (entry.isFile) {
      await Deno.copyFile(sourcePath, targetPath);
    } else if (entry.isDirectory) {
      await copyDirectory(sourcePath, targetPath);
    }
  }
}
