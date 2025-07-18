#!/usr/bin/env -S deno run --allow-all
import { Ask } from "jsr:@sallai/ask@2.0.2";
import $ from "jsr:@david/dax";

const ask = new Ask();

async function bundleWithJSROnly(packageDir: string, entrypoint: string) {
  console.log("\n🔨 Bundling with esbuild (JSR-only mode)...");

  const externalDeps = new Set<string>();

  try {
    const { build } = await import("npm:esbuild@0.25.5");
    
    // First build for JavaScript bundle
    await build({
      entryPoints: [`${packageDir}/${entrypoint}`],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: `${packageDir}/dist/bundle.mjs`,
      banner: {
        js: "#!/usr/bin/env node",
      },
      plugins: [
        {
          name: "jsr-only",
          setup(build: {
            onResolve: (
              filter: { filter: RegExp },
              callback: (args: {
                path: string;
                importer?: string;
              }) => { path: string; external: boolean } | null,
            ) => void;
          }) {
            build.onResolve(
              { filter: /.*/ },
              (args: { path: string; importer?: string }) => {
                console.log("Resolving:", args.path);

                // Don't mark the entry point as external
                if (!args.importer) {
                  console.log("  → Including entry point");
                  return null;
                }

                // Include JSR packages
                if (
                  args.path.startsWith("@jsr/") ||
                  args.path.startsWith("jsr:")
                ) {
                  console.log("  → Including JSR package");
                  return null; // Let esbuild handle it
                }

                // Include relative/absolute paths
                if (args.path.startsWith(".") || args.path.startsWith("/")) {
                  console.log("  → Including relative/absolute path");
                  return null;
                }

                if (args.path.startsWith("node:")) {
                  console.log("  → Excluding Node.js built-in");
                  return { path: args.path, external: true };
                }

                console.log("  → Excluding third-party package");
                externalDeps.add(args.path);
                return { path: args.path, external: true };
              },
            );
          },
        },
      ],
      write: true,
    });

    console.log("✅ Bundle created successfully!");

    // Copy existing TypeScript declarations from JSR package
    console.log("🔨 Copying TypeScript declarations...");
    await copyTypeScriptDeclarations(packageDir, entrypoint);

    // Make the bundle executable if it has a shebang
    try {
      const bundlePath = `${packageDir}/dist/bundle.mjs`;
      const bundleContent = await Deno.readTextFile(bundlePath);
      if (bundleContent.startsWith("#!/usr/bin/env node")) {
        const fileInfo = await Deno.stat(bundlePath);
        const currentMode = fileInfo.mode || 0o644;
        // Add execute permissions (user, group, other)
        await Deno.chmod(bundlePath, currentMode | 0o111);
        console.log("✅ Made bundle executable");
      }
    } catch (chmodError) {
      console.warn("⚠️ Could not make bundle executable:", chmodError);
    }

    const externalDepsArray = Array.from(externalDeps);
    console.log(
      `📦 Collected ${externalDepsArray.length} external dependencies:`,
    );
    externalDepsArray.forEach((dep) => console.log(`  - ${dep}`));

    await generatePackageJson(packageDir, externalDepsArray, entrypoint);
  } catch (_error) {
    console.error("❌ Build failed:", _error);
    throw _error;
  }

  console.log("✅ JSR-only bundling completed!");
}

async function generatePackageJson(packageDir: string, externalDeps: string[], entrypoint: string) {
  console.log("\n📋 Generating package.json with external dependencies...");

  const distPackageJsonPath = `${packageDir}/dist/package.json`;
  
  // Always regenerate package.json to ensure it has the correct fields including 'types'
  console.log("📋 Generating new package.json with all required fields...");

  // Read original JSR package's package.json
  let originalPackageJson: Record<string, unknown> = {};
  try {
    const originalPackageJsonContent = await Deno.readTextFile(
      `${packageDir}/package.json`,
    );
    originalPackageJson = JSON.parse(originalPackageJsonContent);
    console.log("✅ Found original package.json in JSR package");
  } catch (error) {
    console.warn("⚠️ Could not read original package.json:", error);
    // If reading fails, use default values
    originalPackageJson = {
      name: "converted-jsr-package",
      version: "1.0.0",
      description: "Converted JSR package with external dependencies",
      license: "MIT",
    };
  }

  // Read package-lock.json to get version information
  let packageLock: Record<string, unknown> = {};

  try {
    const packageLockContent = await Deno.readTextFile(
      `${Deno.cwd()}/package-lock.json`,
    );
    packageLock = JSON.parse(packageLockContent);
  } catch (error) {
    console.warn("⚠️ Could not read package-lock.json:", error);
  }

  // Build dependencies object
  const dependencies: Record<string, string> = {};

  for (const dep of externalDeps) {
    // Skip Node.js built-in modules
    if (dep.startsWith("node:")) {
      continue;
    }

    // Filter out packages with paths, only keep @scope/name format
    const packageParts = dep.split("/");
    let packageName = dep;

    if (dep.startsWith("@") && packageParts.length > 2) {
      // For @scope/name/path format, only keep @scope/name
      packageName = `${packageParts[0]}/${packageParts[1]}`;
    } else if (!dep.startsWith("@") && packageParts.length > 1) {
      // For package/path format, only keep package
      packageName = packageParts[0];
    }

    // If this package has already been processed, skip it
    if (dependencies[packageName]) {
      continue;
    }

    // Get version from package-lock.json
    let version = "latest";

    const packages =
      (packageLock.packages as Record<string, { version?: string }>) || {};

    // Look for the corresponding package in package-lock.json packages
    for (const [pkgPath, pkgInfo] of Object.entries(packages)) {
      // Extract package name from path, support nested node_modules
      // For example, extract "@scope/name" from "node_modules/@scope/name" or "node_modules/pkg/node_modules/@scope/name"
      let lockPackageName = "";

      // Find package name after the last node_modules
      const nodeModulesIndex = pkgPath.lastIndexOf("node_modules/");
      if (nodeModulesIndex !== -1) {
        const afterNodeModules = pkgPath.substring(
          nodeModulesIndex + "node_modules/".length,
        );
        const pathParts = afterNodeModules.split("/");

        if (pathParts[0]?.startsWith("@")) {
          // Handle scoped package: @scope/name
          lockPackageName = `${pathParts[0]}/${pathParts[1]}`;
        } else {
          // Handle normal package: package
          lockPackageName = pathParts[0];
        }
      }

      if (lockPackageName === packageName && pkgInfo.version) {
        version = pkgInfo.version;
        break;
      }
    }

    dependencies[packageName] = version;
    console.log(`  📌 ${packageName}: ${version}`);
  }

  // Create the new package.json
  const newPackageJson: Record<string, unknown> = { ...originalPackageJson };

  // Remove fields that are no longer correct
  delete newPackageJson.main;
  delete newPackageJson.module;
  delete newPackageJson.types;
  delete newPackageJson.devDependencies;
  delete newPackageJson.scripts;
  delete newPackageJson.files; // The new package only has the dist folder
  // JSR adds some fields we should clean up.
  delete newPackageJson._jsr_revision;
  // The original dependencies are for Deno/JSR, we need npm dependencies.
  delete newPackageJson.dependencies;

  // Set new/correct fields
  newPackageJson.type = "module";
  newPackageJson.main = "./bundle.mjs";
  
  // Set types field based on entrypoint file in types/ directory
  const entrypointDtsFile = entrypoint.replace(/\.(ts|js)$/, '.d.ts');
  try {
    await Deno.stat(`${packageDir}/dist/types/${entrypointDtsFile}`);
    newPackageJson.types = `./types/${entrypointDtsFile}`;
    console.log(`  📝 Using types/${entrypointDtsFile} as types entry point`);
  } catch {
    // Fallback to mod.d.ts if entrypoint .d.ts doesn't exist
    try {
      await Deno.stat(`${packageDir}/dist/types/mod.d.ts`);
      newPackageJson.types = "./types/mod.d.ts";
      console.log("  📝 Using types/mod.d.ts as types entry point");
    } catch {
      // Final fallback to any .d.ts file in types/
      try {
        const typesDir = `${packageDir}/dist/types`;
        const distFiles = [];
        for await (const entry of Deno.readDir(typesDir)) {
          if (entry.isFile && entry.name.endsWith('.d.ts')) {
            distFiles.push(entry.name);
          }
        }
        
        if (distFiles.length > 0) {
          newPackageJson.types = `./types/${distFiles[0]}`;
          console.log(`  📝 Using types/${distFiles[0]} as types entry point`);
        } else {
          console.log("  ⚠️ No .d.ts files found in types/, omitting types field");
        }
      } catch {
        console.log("  ⚠️ Could not check for .d.ts files in types/, omitting types field");
      }
    }
  }
  
  newPackageJson.dependencies = dependencies;
  newPackageJson.scripts = {
    start: "node bundle.mjs",
  };

  // Handle exports (support types for ESM/TS)
  const newExports: Record<string, unknown> = {};
  // Main entry with types
  newExports["."] = {
    import: "./bundle.mjs",
    types: newPackageJson.types,
  };
  newExports["./types/*"] = "./types/*";
  if (originalPackageJson.bin) {
    newExports["./bin"] = "./bundle.mjs";
  }
  newPackageJson.exports = newExports;

  // If original had a bin field, preserve it and point to bundle
  if (originalPackageJson.bin) {
    const newBin: Record<string, string> = {};
    for (
      const key of Object.keys(
        originalPackageJson.bin as Record<string, string>,
      )
    ) {
      newBin[key] = "./bundle.mjs";
    }
    newPackageJson.bin = newBin;
  }

  // @ts-ignore - name exists in originalPackageJson
  newPackageJson.name = "@jsr2npm/" + originalPackageJson.name.split("/").pop();

  const newPackageJsonContent = JSON.stringify(newPackageJson, null, 2);
  await Deno.writeTextFile(
    `${packageDir}/dist/package.json`,
    newPackageJsonContent,
  );

  console.log(
    `✅ Generated package.json based on original JSR package with ${
      Object.keys(dependencies).length
    } external dependencies`,
  );
  console.log(`📄 package.json created at: ${packageDir}/dist/package.json`);
}

async function copyTypeScriptDeclarations(packageDir: string, entrypoint: string) {
  console.log(`  📝 Copying TypeScript declarations from _dist...`);
  
  try {
    const distDirPath = `${packageDir}/_dist`;
    
    // Check if _dist directory exists
    await Deno.stat(distDirPath);
    console.log(`  📁 Found _dist directory, copying all contents...`);
    
    // Create types directory in our dist folder
    const typesDir = `${packageDir}/dist/types`;
    await Deno.mkdir(typesDir, { recursive: true });
    
    // Copy entire _dist directory contents to our dist/types directory
    for await (const entry of Deno.readDir(distDirPath)) {
      const sourcePath = `${distDirPath}/${entry.name}`;
      const targetPath = `${typesDir}/${entry.name}`;
      
      if (entry.isFile) {
        await Deno.copyFile(sourcePath, targetPath);
        console.log(`  ✅ Copied ${entry.name} to types/`);
      } else if (entry.isDirectory) {
        // Recursively copy subdirectories if needed
        await Deno.mkdir(targetPath, { recursive: true });
        for await (const subEntry of Deno.readDir(sourcePath)) {
          if (subEntry.isFile) {
            await Deno.copyFile(`${sourcePath}/${subEntry.name}`, `${targetPath}/${subEntry.name}`);
          }
        }
        console.log(`  ✅ Copied directory ${entry.name} to types/`);
      }
    }
    
    console.log(`  ✅ TypeScript declarations copied successfully to types/ folder`);
    
  } catch (error) {
    console.warn("⚠️ Failed to copy _dist directory:", error);
    console.log("  ⚠️ No TypeScript declarations could be copied");
  }
}



async function copyExtraFiles(sourceDir: string, targetDir: string) {
  console.log(`\n📄 Copying extra files from ${sourceDir} to ${targetDir}...`);
  const filesToCopy = ["README.md", "README", "LICENSE", "LICENSE.md"];

  for (const file of filesToCopy) {
    const sourcePath = `${sourceDir}/${file}`;
    const targetPath = `${targetDir}/${file}`;

    try {
      await Deno.stat(sourcePath);
      await Deno.copyFile(sourcePath, targetPath);
      console.log(`  ✅ Copied ${file}`);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        // File doesn't exist, which is fine.
      } else {
        console.warn(`  ⚠️ Could not copy ${file}:`, error);
      }
    }
  }
}

async function main() {
  console.log("🚀 JSR to NPM Package Converter\n");

  // Prompt for JSR package name
  const packageNameResult = await ask.input({
    name: "package",
    message: "Enter JSR package name (e.g., @std/fs):",
    validate: (input?: string) => {
      if (!input || !input.trim()) {
        return false;
      }
      // Basic validation for JSR package format
      if (!input.includes("@") || !input.includes("/")) {
        return false;
      }
      return true;
    },
  });
  const packageName = packageNameResult.package as string;

  // Prompt for version (optional)
  const versionResult = await ask.input({
    name: "version",
    message: "Enter version (optional, leave blank for latest):",
    default: "latest",
  });

  const version = versionResult.version;

  // Prompt for entrypoint file (optional)
  const entrypointResult = await ask.input({
    name: "entrypoint",
    message: "Enter entrypoint file (optional, leave blank for mod.ts):",
    default: "mod.ts",
    validate: (input?: string) => {
      if (!input || !input.trim()) {
        return true; // Allow empty input, will use default value
      }
      // Validate if input looks like a filename
      if (input.includes("@") || input.includes(" ")) {
        return false; // Don't allow inputs containing @ or spaces
      }
      // Ensure it has a file extension
      if (!input.includes(".")) {
        return false;
      }
      return true;
    },
  });
  const entrypoint = entrypointResult.entrypoint || "mod.ts";

  console.log(`\n📦 Package: ${packageName}`);
  console.log(`🏷️  Version: ${version}`);

  try {
    console.log("\n🚀 Starting conversion process...\n");

    // Step 0: Create a new folder for this conversion
    const sanitizedPackageName = packageName.replace(/[@\/]/g, "__");
    const folderName = `${sanitizedPackageName}_${version}`;
    console.log(`📁 Creating conversion folder: ${folderName}`);
    await Deno.mkdir(folderName, { recursive: true });

    // Change to the new directory
    Deno.chdir(folderName);
    console.log(`✅ Working in: ${Deno.cwd()}`);

    // Step 1: Add JSR package using npx jsr add
    const packageWithVersion = version === "latest"
      ? packageName
      : `${packageName}@${version}`;
    // Create an empty package.json file before adding the JSR package
    const packageJsonPath = `${Deno.cwd()}/package.json`;
    await Deno.writeTextFile(packageJsonPath, "{}");
    console.log("📝 Created empty package.json");

    console.log(`🔄 Running: npx jsr add ${packageWithVersion}`);
    await $`npx jsr add ${packageWithVersion}`.cwd(Deno.cwd());

    // Step 2: Extract package name without version for directory navigation
    const packageWithoutVersion = packageName;
    console.log(`\n📁 Navigating to node_modules/${packageWithoutVersion}`);

    // Step 3: Check if mod.ts exists in the package directory
    const packageDir = `node_modules/${packageWithoutVersion}`;
    try {
      await Deno.stat(`${packageDir}/${entrypoint}`);
      console.log(`✅ Found ${entrypoint} in ${packageDir}`);
    } catch {
      throw new Error(`❌ ${entrypoint} not found in ${packageDir}`);
    }

    // Step 4: Create dist directory if it doesn't exist
    try {
      await Deno.mkdir(`${packageDir}/dist`, { recursive: true });
    } catch {
      // Directory might already exist, ignore error
    }

    // Step 5: Bundle with custom JSR-only configuration
    await bundleWithJSROnly(packageDir, entrypoint);

    // Copy common project files like README and LICENSE
    await copyExtraFiles(packageDir, `${packageDir}/dist`);

    console.log("\n✅ Conversion completed successfully!");
    console.log(
      `📦 Bundle created at: ${Deno.cwd()}/${packageDir}/dist/bundle.mjs`,
    );
    console.log(
      `� TypeScript declarations created at: ${Deno.cwd()}/${packageDir}/dist/bundle.d.ts`,
    );
    console.log(
      `�📄 Dependencies package.json created at: ${Deno.cwd()}/${packageDir}/dist/package.json`,
    );
    console.log(`📂 Conversion folder: ${folderName}`);

    // Move dist folder to conversion root
    console.log("📁 Moving dist folder to conversion root...");
    const targetDistPath = `${Deno.cwd()}/dist`;
    const sourceDistPath = `${packageDir}/dist`;

    // Check if target dist already has package.json and preserve it
    let existingPackageJson: string | null = null;
    const targetPackageJsonPath = `${targetDistPath}/package.json`;
    try {
      existingPackageJson = await Deno.readTextFile(targetPackageJsonPath);
      console.log(
        "📋 Found existing package.json in target dist, will be replaced with new one",
      );
    } catch {
      // No existing package.json, which is fine
    }

    // Remove existing dist directory if it exists
    try {
      await Deno.remove(targetDistPath, { recursive: true });
      console.log("🗑️  Removed existing dist directory");
    } catch {
      // Directory doesn't exist, which is fine
    }

    await Deno.rename(sourceDistPath, targetDistPath);

    // Don't restore existing package.json - use the new one we generated
    console.log("✅ Using newly generated package.json with correct types field");

    // Step 6: Copy extra files like README and LICENSE
    await copyExtraFiles(packageDir, targetDistPath);
  } catch (error) {
    console.error("\n❌ Conversion failed:");
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

// Run the CLI
if (import.meta.main) {
  main().catch(console.error);
}
