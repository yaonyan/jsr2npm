import $ from "jsr:@david/dax";
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

  if (bin && Object.keys(bin).length > 0) {
    console.log(`� CLI Commands: ${Object.keys(bin).join(", ")}`);
  }

  const folderName = createFolderName(packageName, version);
  await Deno.mkdir(folderName, { recursive: true });
  console.log(`📁 Created folder: ${folderName}`);

  const originalCwd = Deno.cwd();

  try {
    Deno.chdir(folderName);
    
    await installJSRPackage(packageName, version);
    
    const packageDir = `node_modules/${packageName}`;
    
    await Deno.mkdir(`${packageDir}/dist`, { recursive: true });

    // Bundle bin commands if configured
    if (bin && Object.keys(bin).length > 0) {
      console.log("\n🔨 Bundling CLI tools...");
      for (const [cmdName, inputFile] of Object.entries(bin)) {
        await verifyEntrypoint(packageDir, inputFile);
        const outputFile = `bin/${cmdName}.mjs`;
        await bundleWithEsbuild(packageDir, inputFile, outputFile);
        
        // Make executable
        const outputPath = `${packageDir}/dist/${outputFile}`;
        await Deno.chmod(outputPath, 0o755);
        console.log(`  ✅ Created ${cmdName}: ${outputFile}`);
      }
    }

    // Copy type declarations
    await copyTypeDeclarations(packageDir);

    await copyExtraFiles(packageDir, `${packageDir}/dist`);
    await generatePackageJson(
      packageDir,
      bin,
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
