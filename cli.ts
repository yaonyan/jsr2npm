import { loadConfig } from "./config.ts";
import { convertPackage } from "./converter.ts";

async function main() {
  console.log("🚀 JSR to NPM Package Converter\n");

  const configFile = Deno.args[0] || "jsr2npm.config.json";
  const config = await loadConfig(configFile);

  if (!config?.packages?.length) {
    console.error("❌ No packages found in jsr2npm.config.json");
    console.log("\n💡 Create a jsr2npm.config.json file with your packages:");
    console.log(`
{
  "packages": [
    {
      "name": "@scope/package",
      "version": "1.0.0",
      "bin": {
        "your-command": "src/bin.ts"
      },
      "packageJson": {
        "name": "@myorg/custom-name",
        "description": "Package description"
      }
    }
  ]
}
    `);
    Deno.exit(1);
  }

  console.log(`📋 Found ${config.packages.length} package(s) in config\n`);

  for (const pkg of config.packages) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Converting: ${pkg.name}@${pkg.version}`);
    console.log("=".repeat(60));

    try {
      await convertPackage(
        pkg.name,
        pkg.version,
        pkg.bin,
        pkg.packageJson,
      );
    } catch (error) {
      console.error(
        `\n❌ Failed to convert ${pkg.name}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ All packages processed!");
  console.log("=".repeat(60));
}

if (import.meta.main) {
  main().catch(console.error);
}
