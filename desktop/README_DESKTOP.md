# Rose AI Assistant - Desktop Wrapper (Electron)

Instructions to build and package the Rose AI Assistant desktop application for Windows.

## Quick Start Commands

1. **Install root dependencies & build web app**:
   ```bash
   npm install
   npm run build
   ```

2. **Install desktop package dependencies**:
   ```bash
   cd desktop
   npm install
   ```

3. **Run desktop app in development**:
   ```bash
   npm run desktop:start
   ```

4. **Build Windows Installer (NSIS .exe)**:
   ```bash
   npm run desktop:dist
   ```
   The generated installer will be located in the `desktop/release/` directory.
