import $ from "@david/dax";
import { bundleWithEsbuild, copyTypeDeclarations } from "./bundler.ts";
import { generatePackageJson, copyExtraFiles } from "./package-generator.ts";
import type { PackageOverrides } from "./config.ts";

export async function convertPackage(
  packageName: string,
  version: string,
  bin?: Record<string, string>,
  overrides?: PackageOverrides
) {
  console.log(`\n📦 Package: ${packageName}`);
  console.log(`🏷️  Version: ${version}`);
  
  if (bin) {
    console.log(`🔧 CLI Commands: ${Object.keys(bin).join(", ")}`);
  }

  const workspaceDir = createWorkspace(packageName, version);
  const originalCwd = Deno.cwd();

  try {
    Deno.chdir(workspaceDir);
    
    await installJSRPackage(packageName, version);
    
    const packageDir = `node_modules/${packageName}`;
    await Deno.mkdir(`${packageDir}/dist`, { recursive: true });

    // Bundle files
    await bundlePackage(packageDir, bin);

    // Copy files and generate metadata
    await copyTypeDeclarations(packageDir);
    await copyExtraFiles(packageDir, `${packageDir}/dist`);
    await generatePackageJson(packageDir, bin, overrides);
    await moveDistToRoot(packageDir);

    console.log("\n✅ Conversion completed!");
    console.log(`📂 Output: ${workspaceDir}/dist`);
  } finally {
    Deno.chdir(originalCwd);
  }
}

function createWorkspace(packageName: string, version: string): string {
  const folderName = packageName.replace(/[@\/]/g, "__") + `_${version}`;
  Deno.mkdirSync(folderName, { recursive: true });
  console.log(`📁 Created folder: ${folderName}`);
  return folderName;
}

async function bundlePackage(packageDir: string, bin?: Record<string, string>) {
  if (bin) {
    await bundleBinCommands(packageDir, bin);
  } else {
    await bundleLibraryExports(packageDir);
  }
}

async function bundleBinCommands(packageDir: string, bin: Record<string, string>) {
  console.log("\n🔨 Bundling CLI tools...");
  
  for (const [cmdName, inputFile] of Object.entries(bin)) {
    await verifyEntrypoint(packageDir, inputFile);
    
    const outputFile = `bin/${cmdName}.mjs`;
    await bundleWithEsbuild(packageDir, inputFile, outputFile);
    
    const outputPath = `${packageDir}/dist/${outputFile}`;
    await Deno.chmod(outputPath, 0o755);
    
    console.log(`  ✅ Created ${cmdName}: ${outputFile}`);
  }
}

async function bundleLibraryExports(packageDir: string) {
  const exports = await readDenoJsonExports(packageDir);
  if (!exports) return;

  console.log("\n🔨 Bundling library exports...");
  
  for (const [exportKey, inputFile] of Object.entries(exports)) {
    await verifyEntrypoint(packageDir, inputFile);
    
    const outputFile = exportKey === "." 
      ? "index.mjs"
      : `${exportKey.replace(/^\.\//, "")}.mjs`;
      
    await bundleWithEsbuild(packageDir, inputFile, outputFile);
    console.log(`  ✅ Bundled ${exportKey}: ${outputFile}`);
  }
}

async function installJSRPackage(packageName: string, version: string) {
  await Deno.writeTextFile("package.json", "{}");
  
  const packageSpec = version === "latest" ? packageName : `${packageName}@${version}`;
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

async function readDenoJsonExports(packageDir: string): Promise<Record<string, string> | null> {
  for (const file of ["deno.json", "deno.jsonc"]) {
    try {
      const content = await Deno.readTextFile(`${packageDir}/${file}`);
      const denoJson = JSON.parse(content);
      
      if (!denoJson.exports) continue;
      
      const exports: Record<string, string> = {};
      for (const [key, value] of Object.entries(denoJson.exports)) {
        const path = typeof value === 'string' ? value : null;
        if (path?.endsWith('.ts')) {
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
  const sourceDist = `${packageDir}/dist`;
  const targetDist = `${Deno.cwd()}/dist`;

  try {
    await Deno.remove(targetDist, { recursive: true });
  } catch {
    // Target doesn't exist, ignore
  }

  await Deno.rename(sourceDist, targetDist);
  await copyExtraFiles(packageDir, targetDist);
}
