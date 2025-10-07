export async function bundleWithEsbuild(
  packageDir: string,
  inputFile: string,
  outputFile: string,
  externalPackages: string[] = []
): Promise<void> {
  const { build } = await import("npm:esbuild@0.25.5");

  const entryPath = `${Deno.cwd()}/${packageDir}/${inputFile}`;
  const outputPath = `${Deno.cwd()}/${packageDir}/dist/${outputFile}`;
  const outputDir = outputPath.split("/").slice(0, -1).join("/");
  
  await Deno.mkdir(outputDir, { recursive: true });

  const externalList = externalPackages.length > 0 ? externalPackages.join(", ") : "none";
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

  const sourceDir = `${packageDir}/_dist`;
  const targetDir = `${packageDir}/dist/types`;

  try {
    await Deno.stat(sourceDir);
    await Deno.mkdir(targetDir, { recursive: true });

    for await (const entry of Deno.readDir(sourceDir)) {
      const source = `${sourceDir}/${entry.name}`;
      const target = `${targetDir}/${entry.name}`;

      if (entry.isFile) {
        await Deno.copyFile(source, target);
      } else if (entry.isDirectory) {
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
