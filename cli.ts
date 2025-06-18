#!/usr/bin/env -S deno run --allow-read --allow-net --allow-env
import { Ask } from "jsr:@sallai/ask@2.0.2";
import $ from "jsr:@david/dax";

const ask = new Ask();

async function bundleWithJSROnly(packageDir: string, entrypoint: string) {
  console.log("\n🔨 Bundling with esbuild (JSR-only mode)...");

  const externalDeps = new Set<string>();

  try {
    const { build } = await import("npm:esbuild@0.25.5");
    await build({
      entryPoints: [`${packageDir}/${entrypoint}`],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: `${packageDir}/dist/bundle.mjs`,
      plugins: [
        {
          name: "jsr-only",
          setup(build: {
            onResolve: (
              filter: { filter: RegExp },
              callback: (args: {
                path: string;
                importer?: string;
              }) => { path: string; external: boolean } | null
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

                // 包含 JSR 包
                if (
                  args.path.startsWith("@jsr/") ||
                  args.path.startsWith("jsr:")
                ) {
                  console.log("  → Including JSR package");
                  return null; // 让 esbuild 处理
                }

                // 包含相对路径
                if (args.path.startsWith(".") || args.path.startsWith("/")) {
                  console.log("  → Including relative/absolute path");
                  return null;
                }

                // 排除 Node.js 内置模块
                if (args.path.startsWith("node:")) {
                  console.log("  → Excluding Node.js built-in");
                  return { path: args.path, external: true };
                }

                // 排除其他所有第三方包并收集它们
                console.log("  → Excluding third-party package");
                externalDeps.add(args.path);
                return { path: args.path, external: true };
              }
            );
          },
        },
      ],
      write: true,
    });

    console.log("✅ Bundle created successfully!");

    // 将收集到的外部依赖转换为数组
    const externalDepsArray = Array.from(externalDeps);
    console.log(
      `📦 Collected ${externalDepsArray.length} external dependencies:`
    );
    externalDepsArray.forEach((dep) => console.log(`  - ${dep}`));

    // 获取依赖版本并生成 package.json
    await generatePackageJson(packageDir, externalDepsArray);
  } catch (error) {
    console.error("❌ Build failed:", error);
    throw error;
  }

  console.log("✅ JSR-only bundling completed!");
}

async function generatePackageJson(packageDir: string, externalDeps: string[]) {
  console.log("\n📋 Generating package.json with external dependencies...");

  // 读取原始 JSR 包的 package.json
  let originalPackageJson: Record<string, unknown> = {};
  try {
    const originalPackageJsonContent = await Deno.readTextFile(
      `${packageDir}/package.json`
    );
    originalPackageJson = JSON.parse(originalPackageJsonContent);
    console.log("✅ Found original package.json in JSR package");
  } catch (error) {
    console.warn("⚠️ Could not read original package.json:", error);
    // 如果读取失败，使用默认值
    originalPackageJson = {
      name: "converted-jsr-package",
      version: "1.0.0",
      description: "Converted JSR package with external dependencies",
      license: "MIT",
    };
  }

  // 读取 package-lock.json 获取版本信息
  let packageLock: Record<string, unknown> = {};

  try {
    const packageLockContent = await Deno.readTextFile(
      `${Deno.cwd()}/package-lock.json`
    );
    packageLock = JSON.parse(packageLockContent);
  } catch (error) {
    console.warn("⚠️ Could not read package-lock.json:", error);
  }

  // 构建依赖对象
  const dependencies: Record<string, string> = {};

  for (const dep of externalDeps) {
    // 跳过 Node.js 内置模块
    if (dep.startsWith("node:")) {
      continue;
    }

    // 过滤掉带路径的包，只保留 @scope/name 格式
    const packageParts = dep.split("/");
    let packageName = dep;

    if (dep.startsWith("@") && packageParts.length > 2) {
      // 对于 @scope/name/path 格式，只保留 @scope/name
      packageName = `${packageParts[0]}/${packageParts[1]}`;
    } else if (!dep.startsWith("@") && packageParts.length > 1) {
      // 对于 package/path 格式，只保留 package
      packageName = packageParts[0];
    }

    // 如果已经处理过这个包，跳过
    if (dependencies[packageName]) {
      continue;
    }

    // 从 package-lock.json 中获取版本
    let version = "latest";

    const packages =
      (packageLock.packages as Record<string, { version?: string }>) || {};

    // 在 package-lock.json 的 packages 中查找对应的包
    for (const [pkgPath, pkgInfo] of Object.entries(packages)) {
      // 从路径中提取包名，支持嵌套的 node_modules
      // 例如从 "node_modules/@scope/name" 或 "node_modules/pkg/node_modules/@scope/name" 提取 "@scope/name"
      let lockPackageName = "";

      // 找到最后一个 node_modules 后的包名
      const nodeModulesIndex = pkgPath.lastIndexOf("node_modules/");
      if (nodeModulesIndex !== -1) {
        const afterNodeModules = pkgPath.substring(
          nodeModulesIndex + "node_modules/".length
        );
        const pathParts = afterNodeModules.split("/");

        if (pathParts[0]?.startsWith("@")) {
          // 处理 scoped package: @scope/name
          lockPackageName = `${pathParts[0]}/${pathParts[1]}`;
        } else {
          // 处理普通 package: package
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
  newPackageJson.dependencies = dependencies;
  newPackageJson.scripts = {
    start: "node bundle.mjs",
  };

  // Handle exports
  const newExports: Record<string, string> = {};
  newExports["."] = "./bundle.mjs"; // Main entry point

  // If original had a bin export, preserve it and point to bundle
  const originalExports = originalPackageJson.exports as
    | Record<string, unknown>
    | undefined;
  if (originalExports && originalExports["./bin"]) {
    newExports["./bin"] = "./bundle.mjs";
  }
  newPackageJson.exports = newExports;

  // If original had a bin field, preserve it and point to bundle
  if (originalPackageJson.bin) {
    const newBin: Record<string, string> = {};
    for (const key of Object.keys(
      originalPackageJson.bin as Record<string, string>
    )) {
      newBin[key] = "./bundle.mjs";
    }
    newPackageJson.bin = newBin;
  }

  const newPackageJsonContent = JSON.stringify(newPackageJson, null, 2);
  await Deno.writeTextFile(
    `${packageDir}/dist/package.json`,
    newPackageJsonContent
  );

  console.log(
    `✅ Generated package.json based on original JSR package with ${
      Object.keys(dependencies).length
    } external dependencies`
  );
  console.log(`📄 package.json created at: ${packageDir}/dist/package.json`);
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
        return true; // 允许空输入，会使用默认值
      }
      // 验证输入是否像文件名
      if (input.includes("@") || input.includes(" ")) {
        return false; // 不允许包含 @ 或空格的输入
      }
      // 确保有文件扩展名
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
    const packageWithVersion =
      version === "latest" ? packageName : `${packageName}@${version}`;
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
      `📦 Bundle created at: ${Deno.cwd()}/${packageDir}/dist/bundle.mjs`
    );
    console.log(
      `📄 Dependencies package.json created at: ${Deno.cwd()}/${packageDir}/dist/package.json`
    );
    console.log(`📂 Conversion folder: ${folderName}`);

    // Move dist folder to conversion root
    console.log("📁 Moving dist folder to conversion root...");
    const targetDistPath = `${Deno.cwd()}/dist`;

    // Remove existing dist directory if it exists
    try {
      await Deno.remove(targetDistPath, { recursive: true });
      console.log("🗑️  Removed existing dist directory");
    } catch {
      // Directory doesn't exist, which is fine
    }

    await Deno.rename(`${packageDir}/dist`, targetDistPath);

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
