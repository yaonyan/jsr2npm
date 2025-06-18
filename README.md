# JSR to NPM Converter

This is a command-line tool to convert a JSR package into a format that can be published to NPM. It handles bundling the code, extracting NPM dependencies, and creating a valid `package.json`.

## How to Use

1.  **Run the script using Deno:**
    ```bash
    deno run --allow-all https://raw.githubusercontent.com/yaonyan/jsr2npm/main/cli.ts
    ```

2.  **Follow the interactive prompts:**
    *   **Enter JSR package name:** The full name of the JSR package (e.g., `@std/fs`).
    *   **Enter version:** (Optional) The version of the package to convert. Defaults to `latest`.
    *   **Enter entrypoint file:** (Optional) The main entrypoint file of the package. Defaults to `mod.ts`.

## What It Does

The script automates the following steps:

1.  **Creates a Workspace:** It makes a new folder named `_<scope>_<name>_<version>` to keep the conversion files organized.

2.  **Fetches the JSR Package:** It uses `npx jsr add` to download the specified JSR package and its Deno dependencies.

3.  **Bundles the Code:**
    *   It uses `esbuild` to bundle the JSR package into a single ESM file (`dist/bundle.mjs`).
    *   It intelligently separates JSR/Deno-native code from third-party NPM packages. JSR packages and relative files are included in the bundle, while NPM packages and Node.js built-ins are marked as external.

4.  **Generates `package.json`:**
    *   It reads the original `package.json` from the downloaded JSR package to preserve metadata like the name, description, and license.
    *   It identifies all external NPM dependencies that were excluded from the bundle.
    *   It looks up the versions for these dependencies from the `package-lock.json` file.
    *   It generates a new `package.json` in the `dist` folder with the correct NPM dependencies, `exports` pointing to the bundle, and a basic `start` script.

5.  **Copies Auxiliary Files:** It copies important files like `README.md` and `LICENSE` from the original JSR package into the final `dist` directory.

6.  **Final Output:** The final, ready-to-publish NPM package is placed in the `dist` directory inside the conversion folder.

## Requirements

*   [Deno](https://deno.land/)
*   [Node.js](https://nodejs.org/) (which includes `npx`)
