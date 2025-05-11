# FunOption-test

A development and testing project for the **Bybit Testnet API client**.

---

## Table of Contents

1. [Overview](#overview)
2. [Setup](#setup)
3. [Starting the Local Development Server](#starting-the-local-development-server)
4. [Running the Bybit API Test Script](#running-the-bybit-api-test-script)
5. [Notes & Warnings](#notes--warnings)

---

## Overview <a id="overview"></a>

* Lets you develop and verify a client for the **Bybit Testnet API**.
* All test scripts run in **ESM (ECMAScript Modules) format**.

## Setup <a id="setup"></a>

1. Install **Node.js v20 or later** (confirmed working on v23.x).
2. Create a `.env` file and add your Bybit API key and secret.
3. Install dependencies:

   ```sh
   npm install
   ```

## Starting the Local Development Server <a id="starting-the-local-development-server"></a>

1. Launch the Vite dev server:

   ```sh
   npm run dev
   ```
2. Open `http://localhost:5173/` in your browser to see the app.

## Running the Bybit API Test Script <a id="running-the-bybit-api-test-script"></a>

1. Compile TypeScript in ESM mode:

   ```sh
   npx tsc --project tsconfig.esm-test.json
   ```
2. Execute the test script:

   ```sh
   node dist/api-esm-test/bybitTest.js
   ```

## Notes & Warnings <a id="notes--warnings"></a>

* The `dist/` directory is already listed in `.gitignore`.
* Because the project uses ESM, **all `import` statements must include the `.js` extension**.
* If you encounter authentication errors or API-response errors, double-check your `.env` settings and the official Bybit API documentation.

### Security & Handling API Keys

Treat your API keys as sensitive credentials:

* **Never commit `.env` or plain-text keys to version control.**
* Rotate keys regularly and use the minimum required permissions.
* In CI/CD or cloud environments, rely on secure secrets managers instead of environment files whenever possible.

