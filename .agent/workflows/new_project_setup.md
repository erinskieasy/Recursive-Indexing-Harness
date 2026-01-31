---
description: Setup a new React + Node.js project using the user's template repository (Turbo Mode).
---

This workflow rapidly clones the user's pre-configured template, ensuring all standards (React, Vite, Tailwind, Azure, Dashboard) are met immediately.

## 1. Clone & Re-initialize
1. **Clone Template**:
   - Run `git clone https://github.com/erinskieasy/Blank-React-Azure-ready.git .`
   - *Note*: Ensure the directory is empty or the command may fail.
2. **Reset Git History**:
   - Delete the existing `.git` folder to remove the template's history.
     - PowerShell: `Remove-Item -Recurse -Force .git`
     - Bash: `rm -rf .git`
   - Initialize a fresh git repository: `git init`

## 2. Install & Build
1. **Install**:
   - Run `npm install` to set up all packages.
2. **Build (Azure Prep)**:
   - Run `npm run build` to generate the `dist` folder (production assets).
   - *Reason*: Azure requires the `dist` folder to serve the application. This ensures the build config is valid locally.

## 3. Verification & Start
1. **Verify**:
   - Check that `dist/index.html` exists.
   - Check that `src/pages/Dashboard.tsx` exists.
   - Check that `.env` exists.
2. **Start**:
   - Run `npm run dev` to start the development server.
