# JSR to NPM Converter

This is a command-line tool to convert JSR packages into a format that can be published to NPM. It handles bundling the code, extracting NPM dependencies, and creating a valid `package.json`.

## How to Use

1.  **Create a `jsr2npm.config.json` file:**

    ### Single Entry Point (Simple)
    ```json
    {
      "packages": [
        {
          "name": "@scope/package-name",
          "version": "1.0.0",
          "entrypoint": "mod.ts",
          "packageJson": {
            "name": "@myorg/custom-name",
            "description": "Custom package description"
          }
        }
      ]
    }
    ```

    ### Multiple Entry Points (Advanced)
    ```json
    {
      "packages": [
        {
          "name": "@scope/cli-tool",
          "version": "1.0.0",
          "entrypoints": [
            {
              "input": "mod.ts",
              "output": "index.mjs",
              "type": "module"
            },
            {
              "input": "cli.ts",
              "output": "bin/cli.mjs",
              "type": "bin"
            }
          ],
          "packageJson": {
            "name": "@myorg/cli-tool",
            "description": "A library with CLI tool"
          }
        }
      ]
    }
    ```

    **Entry Point Configuration:**
    - `entrypoint` (string): Single entry point (backward compatible)
    - `entrypoints` (array): Multiple entry points for libraries with CLI tools or multiple exports
      - `input`: Source file path (e.g., "mod.ts", "cli.ts")
      - `output`: Output bundle path (e.g., "index.mjs", "bin/cli.mjs")
      - `type`: Either "module" (library export) or "bin" (executable CLI tool)

    **Available `packageJson` overrides:**
    - `name`: Override the package name (default: `@jsr2npm/original-name`)
    - `version`: Override the package version
    - `description`: Override package description
    - `author`: Override author (string or object with name/email/url)
    - `license`: Override license
    - `homepage`: Override homepage URL
    - `repository`: Override repository (string or object with type/url)
    - `keywords`: Override keywords array
    - `bin`: Override binary commands (auto-generated for "bin" type entries)
    - `scripts`: Merge additional scripts (keeps the default `start` script)

2.  **Run the script:**
    ```bash
    deno run --allow-all cli.ts
    ```

    Or use the remote version:
    ```bash
    deno run --allow-all https://raw.githubusercontent.com/yaonyan/jsr2npm/main/cli.ts
    ```

## What It Does

The script automates the following steps:

1.  **Creates a Workspace:** It makes a new folder named `_<scope>_<name>_<version>` to keep the conversion files organized.

2.  **Fetches the JSR Package:** It uses `npx jsr add` to download the specified JSR package and its Deno dependencies.

3.  **Bundles the Code:**
    *   It uses `esbuild` to bundle the JSR package into one or more ESM files
    *   **Single Entry Point Mode:** Generates `dist/bundle.mjs` (backward compatible)
    *   **Multiple Entry Points Mode:** Generates separate bundles for each entry point
      - Library exports: `dist/index.mjs`, `dist/plugins.mjs`, etc.
      - CLI tools: `dist/bin/cli.mjs` with executable permissions
    *   It intelligently separates JSR/Deno-native code from third-party NPM packages. JSR packages and relative files are included in the bundle, while NPM packages and Node.js built-ins are marked as external.

4.  **Generates `package.json`:**
    *   It reads metadata from both `package.json` and `deno.json` files
    *   It preserves important metadata like name, version, description, author, license, repository, keywords, and homepage from `deno.json`
    *   It identifies all external NPM dependencies that were excluded from the bundle
    *   It looks up the versions for these dependencies from the `package-lock.json` file
    *   It generates a new `package.json` in the `dist` folder with:
      - Correct NPM dependencies
      - `exports` field mapping entry points
      - `bin` field for CLI tools (auto-generated from "bin" type entries)
      - Type declarations paths
      - Basic `start` script
    *   Config overrides take precedence over both `package.json` and `deno.json` values

5.  **Copies Auxiliary Files:** It copies important files like `README.md` and `LICENSE` from the original JSR package into the final `dist` directory.

6.  **Final Output:** The final, ready-to-publish NPM package is placed in the `dist` directory inside the conversion folder.

## Requirements

*   [Deno](https://deno.land/)
*   [Node.js](https://nodejs.org/) (which includes `npx`)
