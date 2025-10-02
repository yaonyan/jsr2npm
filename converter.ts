import $ from "jsr:@david/dax";
import { bundlePackage, bundleMultipleEntrypoints } from "./bundler.ts";
import { generatePackageJson, copyExtraFiles } from "./package-generator.ts";
import type { PackageOverrides, EntrypointConfig } from "./config.ts";

export async function convertPackage(
  packageName: string,
  version: string,
  entrypoint?: string,
  entrypoints?: EntrypointConfig[],
  overrides?: PackageOverrides
) {
  console.log(`\n📦 Package: ${packageName}`);
  console.log(`🏷️  Version: ${version}`);

  // 确保至少有一个入口点
  if (!entrypoint && (!entrypoints || entrypoints.length === 0)) {
    throw new Error("❌ Must provide either entrypoint or entrypoints");
  }

  // 标准化为 entrypoints 数组
  const normalizedEntrypoints: EntrypointConfig[] = entrypoints || [
    { input: entrypoint!, output: "bundle.mjs", type: "bin" }
  ];

  console.log(`📄 Entrypoints: ${normalizedEntrypoints.map(e => e.input).join(", ")}`);

  const folderName = createFolderName(packageName, version);
  await Deno.mkdir(folderName, { recursive: true });
  console.log(`📁 Created folder: ${folderName}`);

  const originalCwd = Deno.cwd();

  try {
    Deno.chdir(folderName);
    
    await installJSRPackage(packageName, version);
    
    const packageDir = `node_modules/${packageName}`;
    
    // 验证所有入口点
    for (const entry of normalizedEntrypoints) {
      await verifyEntrypoint(packageDir, entry.input);
    }
    
    await Deno.mkdir(`${packageDir}/dist`, { recursive: true });

    // 打包所有入口点
    const bundleResults = await bundleMultipleEntrypoints(packageDir, normalizedEntrypoints);
    
    // 合并所有外部依赖
    const allExternalDeps = new Set<string>();
    bundleResults.forEach(result => {
      result.externalDeps.forEach(dep => allExternalDeps.add(dep));
    });

    await copyExtraFiles(packageDir, `${packageDir}/dist`);
    await generatePackageJson(
      packageDir,
      Array.from(allExternalDeps),
      normalizedEntrypoints[0].input, // 主入口点用于类型声明
      normalizedEntrypoints,
      overrides
    );

    await moveDistToRoot(packageDir);

    console.log("\n✅ Conversion completed!");
    console.log(`📂 Output: ${folderName}/dist`);
  } finally {
    Deno.chdir(originalCwd);
  }
}

function createFolderName(packageName: string, version: string): string {
  const sanitized = packageName.replace(/[@\/]/g, "__");
  return `${sanitized}_${version}`;
}

async function installJSRPackage(packageName: string, version: string) {
  await Deno.writeTextFile("package.json", "{}");
  
  const packageSpec = version === "latest" 
    ? packageName 
    : `${packageName}@${version}`;
    
  console.log(`🔄 Installing: ${packageSpec}`);
  await $`npx jsr add ${packageSpec}`.cwd(Deno.cwd());
}

async function verifyEntrypoint(packageDir: string, entrypoint: string) {
  try {
    await Deno.stat(`${packageDir}/${entrypoint}`);
    console.log(`✅ Found ${entrypoint}`);
  } catch {
    throw new Error(`❌ ${entrypoint} not found in ${packageDir}`);
  }
}

async function moveDistToRoot(packageDir: string) {
  const targetDist = `${Deno.cwd()}/dist`;
  const sourceDist = `${packageDir}/dist`;

  try {
    await Deno.remove(targetDist, { recursive: true });
  } catch {
    // Target doesn't exist
  }

  await Deno.rename(sourceDist, targetDist);
  await copyExtraFiles(packageDir, targetDist);
}
