// scripts/download.js
import https from 'https'
import fs from 'fs'
import os from 'os'
import path from 'path'
import unzipper from 'unzipper'
import tar from 'tar'
import { execSync } from 'child_process'

// Helper to download a file
function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} to ${dest}`)
    const file = fs.createWriteStream(dest)
    https
      .get(url, (response) => {
        console.log(`Response status code: ${response.statusCode}`)
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          // Handle redirect
          const redirectURL = response.headers.location
          console.log(`Redirecting to ${redirectURL}`)
          download(redirectURL, dest).then(resolve, reject)
          return
        } else if (response.statusCode !== 200) {
          reject(`Failed to get '${url}' (${response.statusCode})`)
          return
        }
        response.pipe(file)
        file.on('finish', () => {
          file.close(resolve)
        })
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err.message))
      })
  })
}

// Helper to decompress archives
async function decompress(filePath, targetDir) {
  console.log(`Decompressing ${filePath} to ${targetDir}`)
  if (filePath.endsWith('.zip')) {
    await fs
      .createReadStream(filePath)
      .pipe(unzipper.Extract({ path: targetDir }))
      .promise()
  } else if (filePath.endsWith('.tar.gz')) {
    await tar.x({
      file: filePath,
      cwd: targetDir,
    })
  } else {
    throw new Error(`Unsupported archive format: ${filePath}`)
  }
}

// Specific logic for macOS universal build
async function handleMacOsUniversal() {
  console.log('Handling macOS universal binary download...')
  const BUN_VERSION = '1.2.18'
  const UV_VERSION = '0.6.17'
  const BIN_DIR = 'src-tauri/resources/bin'
  const TEMP_DIR = 'scripts/dist'

  // Bun URLs
  const bunAarch64Url = `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-darwin-aarch64.zip`
  const bunX64Url = `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-darwin-x64.zip`

  // UV URLs
  const uvAarch64Url = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-aarch64-apple-darwin.tar.gz`
  const uvX64Url = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-x86_64-apple-darwin.tar.gz`

  // Download paths
  const bunAarch64Zip = path.join(TEMP_DIR, 'bun-darwin-aarch64.zip')
  const bunX64Zip = path.join(TEMP_DIR, 'bun-darwin-x64.zip')
  const uvAarch64Tar = path.join(TEMP_DIR, 'uv-aarch64-apple-darwin.tar.gz')
  const uvX64Tar = path.join(TEMP_DIR, 'uv-x86_64-apple-darwin.tar.gz')

  // Download and decompress all
  await Promise.all([
    download(bunAarch64Url, bunAarch64Zip).then(() => decompress(bunAarch64Zip, TEMP_DIR)),
    download(bunX64Url, bunX64Zip).then(() => decompress(bunX64Zip, TEMP_DIR)),
    download(uvAarch64Url, uvAarch64Tar).then(() => decompress(uvAarch64Tar, TEMP_DIR)),
    download(uvX64Url, uvX64Tar).then(() => decompress(uvX64Tar, TEMP_DIR)),
  ])

  console.log('All macOS binaries downloaded and extracted.')

  // Paths to extracted binaries
  const bunAarch64Path = path.join(TEMP_DIR, 'bun-darwin-aarch64', 'bun')
  const bunX64Path = path.join(TEMP_DIR, 'bun-darwin-x64', 'bun')
  const uvAarch64Path = path.join(TEMP_DIR, 'uv-aarch64-apple-darwin', 'uv')
  const uvX64Path = path.join(TEMP_DIR, 'uv-x86_64-apple-darwin', 'uv')

  // Create universal binaries using lipo
  console.log('Creating universal binaries with lipo...')
  execSync(`lipo -create -output ${path.join(BIN_DIR, 'bun')} ${bunX64Path} ${bunAarch64Path}`)
  execSync(`lipo -create -output ${path.join(BIN_DIR, 'uv')} ${uvX64Path} ${uvAarch64Path}`)

  // Copy architecture-specific binaries
  console.log('Copying architecture-specific binaries...')
  fs.copyFileSync(bunAarch64Path, path.join(BIN_DIR, 'bun-aarch64-apple-darwin'))
  fs.copyFileSync(bunX64Path, path.join(BIN_DIR, 'bun-x86_64-apple-darwin'))
  fs.copyFileSync(uvAarch64Path, path.join(BIN_DIR, 'uv-aarch64-apple-darwin'))
  fs.copyFileSync(uvX64Path, path.join(BIN_DIR, 'uv-x86_64-apple-darwin'))

  // Set executable permissions
  fs.chmodSync(path.join(BIN_DIR, 'bun'), '755')
  fs.chmodSync(path.join(BIN_DIR, 'uv'), '755')
  fs.chmodSync(path.join(BIN_DIR, 'bun-aarch64-apple-darwin'), '755')
  fs.chmodSync(path.join(BIN_DIR, 'bun-x86_64-apple-darwin'), '755')
  fs.chmodSync(path.join(BIN_DIR, 'uv-aarch64-apple-darwin'), '755')
  fs.chmodSync(path.join(BIN_DIR, 'uv-x86_64-apple-darwin'), '755')

  console.log('macOS universal binaries are ready.')
}

// Logic for other platforms (Linux, Windows)
async function handleGenericPlatform() {
  const platform = os.platform()
  const arch = os.arch()
  const BUN_VERSION = '1.2.18'
  const UV_VERSION = '0.6.17'
  const BIN_DIR = 'src-tauri/resources/bin'
  const TEMP_DIR = 'scripts/dist'

  let bunPlatform, uvPlatform, uvExt

  if (platform === 'linux') {
    bunPlatform = arch === 'arm64' ? 'linux-aarch64' : 'linux-x64'
    uvPlatform = arch === 'arm64' ? 'aarch64-unknown-linux-gnu' : 'x86_64-unknown-linux-gnu'
    uvExt = 'tar.gz'
  } else if (platform === 'win32') {
    bunPlatform = 'windows-x64'
    uvPlatform = 'x86_64-pc-windows-msvc'
    uvExt = 'zip'
  } else {
    throw new Error(`Unsupported platform: ${platform}`)
  }

  console.log(`Handling ${platform}-${arch}...`)

  // URLs
  const bunUrl = `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-${bunPlatform}.zip`
  const uvUrl = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-${uvPlatform}.${uvExt}`

  // Download paths
  const bunZip = path.join(TEMP_DIR, `bun-${bunPlatform}.zip`)
  const uvArchive = path.join(TEMP_DIR, `uv-${uvPlatform}.${uvExt}`)

  // Download and decompress
  await download(bunUrl, bunZip).then(() => decompress(bunZip, TEMP_DIR))
  await download(uvUrl, uvArchive).then(() => decompress(uvArchive, TEMP_DIR))

  // Copy to bin dir
  const bunExe = platform === 'win32' ? 'bun.exe' : 'bun'
  const uvExe = platform === 'win32' ? 'uv.exe' : 'uv'

  const bunSrcPath = path.join(TEMP_DIR, `bun-${bunPlatform}`, bunExe)
  const uvSrcPath = platform === 'win32' ? path.join(TEMP_DIR, uvExe) : path.join(TEMP_DIR, `uv-${uvPlatform}`, uvExe)

  fs.copyFileSync(bunSrcPath, path.join(BIN_DIR, bunExe))
  fs.copyFileSync(uvSrcPath, path.join(BIN_DIR, uvExe))

  // Set executable permissions (non-windows)
  if (platform !== 'win32') {
    fs.chmodSync(path.join(BIN_DIR, bunExe), '755')
    fs.chmodSync(path.join(BIN_DIR, uvExe), '755')
  }

  console.log(`${platform} binaries are ready.`)
}

async function main() {
  console.log('Starting binary download script...')

  // Ensure directories exist
  fs.mkdirSync('src-tauri/resources/bin', { recursive: true })
  fs.mkdirSync('scripts/dist', { recursive: true })

  if (os.platform() === 'darwin') {
    await handleMacOsUniversal()
  } else {
    await handleGenericPlatform()
  }

  console.log('Binary download process completed successfully.')
}

main().catch((err) => {
  console.error('Error during binary download:', err)
  process.exit(1)
})
