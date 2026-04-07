import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { setDefaultResultOrder } from 'node:dns'
import { tmpdir } from 'os'
import path from 'path'

try {
  setDefaultResultOrder('ipv4first')
} catch {
  // ignore
}

const DEFAULT_ACTIONLINT_VERSION = '1.7.8'
const ACTIONLINT_VERSION = process.env.ACTIONLINT_VERSION?.trim() || DEFAULT_ACTIONLINT_VERSION
const DEFAULT_ACTIONLINT_DOWNLOAD_BASE = `https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}`
const ACTIONLINT_DOWNLOAD_BASE =
  (process.env.ACTIONLINT_DOWNLOAD_BASE?.trim() || DEFAULT_ACTIONLINT_DOWNLOAD_BASE).replace(/\/$/, '')
const ACTIONLINT_SHA256 = process.env.ACTIONLINT_SHA256?.trim().toLowerCase()

const DEFAULT_ACTIONLINT_SHA256: Record<string, Record<string, string>> = {
  '1.7.8': {
    'darwin-arm64': 'ffb1f6c429a51dc9f37af9d11f96c16bd52f54b713bf7f8bd92f7fce9fd4284a',
    'darwin-x64': '16b85caf792b34bcc40f7437736c4347680da0a1b034353a85012debbd71a461',
    'linux-arm64': '4c65dbb2d59b409cdd75d47ffa8fa32af8f0eee573ac510468dc2275c48bf07c',
    'linux-x64': 'be92c2652ab7b6d08425428797ceabeb16e31a781c07bc388456b4e592f3e36a',
  },
}

function getVersionTag() {
  return ACTIONLINT_VERSION.replace(/^v/, '')
}

function getPlatformKey() {
  return `${process.platform}-${process.arch}`
}

function getPlatformAsset() {
  const versionTag = getVersionTag()
  const platform = process.platform
  const arch = process.arch

  if (platform === 'darwin') {
    if (arch === 'arm64') return `actionlint_${versionTag}_darwin_arm64.tar.gz`
    if (arch === 'x64') return `actionlint_${versionTag}_darwin_amd64.tar.gz`
  }

  if (platform === 'linux') {
    if (arch === 'arm64') return `actionlint_${versionTag}_linux_arm64.tar.gz`
    if (arch === 'x64') return `actionlint_${versionTag}_linux_amd64.tar.gz`
  }

  throw new Error(`Unsupported platform for actionlint: ${platform}-${arch}`)
}

function getCacheDir() {
  return path.resolve(process.cwd(), '.claude', 'bin', 'actionlint', getVersionTag())
}

function getExecutablePath() {
  const exe = process.platform === 'win32' ? 'actionlint.exe' : 'actionlint'
  return path.join(getCacheDir(), exe)
}

function proxyEnvSet() {
  const v = (s: string | undefined) => (s ?? '').trim()
  return !!(
    v(process.env.HTTPS_PROXY) ||
    v(process.env.HTTP_PROXY) ||
    v(process.env.ALL_PROXY) ||
    v(process.env.https_proxy) ||
    v(process.env.http_proxy)
  )
}

async function fetchRelease(url: string): Promise<Response> {
  if (proxyEnvSet()) {
    const { EnvHttpProxyAgent, fetch: undiciFetch } = await import('undici')
    return (await undiciFetch(url, {
      redirect: 'follow',
      dispatcher: new EnvHttpProxyAgent(),
    })) as unknown as Response
  }
  return await fetch(url, { redirect: 'follow' })
}

function tryCurlDownload(url: string, dest: string): boolean {
  const curl = process.platform === 'win32' ? 'curl.exe' : 'curl'
  const result = spawnSync(curl, ['-fsSL', '-L', '--fail', '-o', dest, url], {
    stdio: 'pipe',
    windowsHide: true,
  })
  return result.status === 0 && existsSync(dest) && statSync(dest).size > 0
}

async function downloadUrlToBuffer(url: string): Promise<Buffer> {
  const response = await fetchRelease(url)
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function downloadUrlToBufferWithFallback(url: string): Promise<Buffer> {
  let firstError: unknown
  try {
    return await downloadUrlToBuffer(url)
  } catch (error) {
    firstError = error
  }

  const tmpRoot = path.join(tmpdir(), `actionlint-dl-${process.pid}-${Date.now()}`)
  const tmpFile = path.join(tmpRoot, 'archive.tar.gz')
  mkdirSync(tmpRoot, { recursive: true })
  try {
    if (tryCurlDownload(url, tmpFile)) {
      return readFileSync(tmpFile)
    }
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true })
  }

  throw firstError
}

function sha256Buffer(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function getExpectedSha256() {
  if (ACTIONLINT_SHA256) {
    return ACTIONLINT_SHA256
  }

  const versionChecksums = DEFAULT_ACTIONLINT_SHA256[getVersionTag()]
  if (!versionChecksums) {
    throw new Error(
      `No default SHA256 is defined for actionlint ${ACTIONLINT_VERSION}. Set ACTIONLINT_SHA256 to continue.`,
    )
  }

  const checksum = versionChecksums[getPlatformKey()]
  if (!checksum) {
    throw new Error(
      `No default SHA256 is defined for ${getPlatformKey()} on actionlint ${ACTIONLINT_VERSION}. Set ACTIONLINT_SHA256 to continue.`,
    )
  }

  return checksum
}

function ensureArchiveChecksum(buffer: Buffer) {
  const expected = getExpectedSha256()
  const actual = sha256Buffer(buffer)
  if (actual !== expected) {
    throw new Error(`Actionlint SHA256 mismatch: expected ${expected}, got ${actual}`)
  }
}

function ensureExtractedBinary(archivePath: string, destination: string) {
  mkdirSync(path.dirname(destination), { recursive: true })
  const result = spawnSync('tar', ['-xzf', archivePath, '-C', path.dirname(destination)], {
    stdio: 'pipe',
  })
  if (result.status !== 0) {
    throw new Error(result.stderr.toString() || 'Failed to extract actionlint archive')
  }
  chmodSync(destination, 0o755)
}

async function ensureActionlint() {
  const executablePath = getExecutablePath()
  if (existsSync(executablePath) && statSync(executablePath).size > 0) {
    return executablePath
  }

  const asset = getPlatformAsset()
  const url = `${ACTIONLINT_DOWNLOAD_BASE}/${asset}`
  const cacheDir = getCacheDir()
  mkdirSync(cacheDir, { recursive: true })

  const archivePath = path.join(cacheDir, asset)
  const buffer = await downloadUrlToBufferWithFallback(url)
  ensureArchiveChecksum(buffer)
  writeFileSync(archivePath, buffer)
  ensureExtractedBinary(archivePath, executablePath)
  return executablePath
}

async function main() {
  const executablePath = await ensureActionlint()
  const result = spawnSync(executablePath, ['-color'], {
    stdio: 'inherit',
  })
  process.exit(result.status ?? 1)
}

await main()
