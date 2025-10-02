import type { EntrypointConfig } from "./config.ts";

export interface BundleResult {
  output: string;
  externalDeps: string[];
}

/**
 * 打包单个入口点（向后兼容）
 */
export async function bundlePackage(packageDir: string, entrypoint: string): Promise<string[]> {
  const results = await bundleMultipleEntrypoints(packageDir, [
    { input: entrypoint, output: "bundle.mjs", type: "bin" }
  ]);
  return results[0].externalDeps;
}

/**
 * 打包多个入口点（新功能）
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
    const externalDeps = new Set<string>();

    // Resolve absolute path for entry point
    const entryPath = `${Deno.cwd()}/${packageDir}/${entry.input}`;
    const outputPath = `${Deno.cwd()}/${packageDir}/dist/${entry.output}`;

    // 确保输出目录存在
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
        setup(build: any) {
          build.onResolve({ filter: /.*/ }, (args: { path: string; importer?: string }) => {
            if (!args.importer) {
              return null;
            }

            if (args.path.startsWith("@jsr/") || args.path.startsWith("jsr:")) {
              return null;
            }

            if (args.path.startsWith(".") || args.path.startsWith("/")) {
              return null;
            }

            if (args.path.startsWith("node:")) {
              return { path: args.path, external: true };
            }

            externalDeps.add(args.path);
            return { path: args.path, external: true };
          });
        },
      }],
      write: true,
    });

    console.log(`  ✅ Created ${entry.output}`);

    // 如果是 bin 类型，设置可执行权限
    if (isBin) {
      await makeExecutable(outputPath);
    }

    results.push({
      output: entry.output,
      externalDeps: Array.from(externalDeps),
    });
  }

  // 复制类型声明（使用第一个入口点）
  await copyTypeDeclarations(packageDir, entrypoints[0].input);

  // 合并所有外部依赖
  const allDeps = new Set<string>();
  results.forEach(r => r.externalDeps.forEach(dep => allDeps.add(dep)));
  
  console.log(`\n📦 Collected ${allDeps.size} external dependencies`);
  allDeps.forEach((dep) => console.log(`  - ${dep}`));

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

async function copyTypeDeclarations(packageDir: string, entrypoint: string) {
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
