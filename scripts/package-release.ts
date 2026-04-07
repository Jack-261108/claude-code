import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile, chmod, copyFile } from 'fs/promises'
import { cpSync, createReadStream, existsSync } from 'fs'
import { basename, join, resolve } from 'path'
import { tmpdir } from 'os'
import { spawnSync } from 'child_process'

const projectRoot = process.cwd()
const distDir = resolve(projectRoot, 'dist')
const releaseDir = resolve(projectRoot, 'release')
const packageJsonPath = resolve(projectRoot, 'package.json')
const readmePath = resolve(projectRoot, 'README.md')
const licensePath = resolve(projectRoot, 'LICENSE')
const homebrewDir = resolve(projectRoot, 'packaging', 'homebrew')
const releasePlatforms = [{ arch: 'arm64' }, { arch: 'x64' }] as const
const manifestPath = resolve(releaseDir, 'manifest.json')

function run(command: string, args: string[], cwd = projectRoot) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`)
  }
}

async function ensureFile(path: string) {
  if (!existsSync(path)) {
    throw new Error(`Required file not found: ${path}`)
  }
}

async function getPackageMetadata() {
  const raw = await readFile(packageJsonPath, 'utf-8')
  return JSON.parse(raw) as {
    version: string
    repository?: { url?: string }
  }
}

async function sha256(filePath: string) {
  const hash = createHash('sha256')
  const stream = createReadStream(filePath)
  for await (const chunk of stream) {
    hash.update(chunk)
  }
  return hash.digest('hex')
}

async function createArchive(sourceDir: string, outputPath: string) {
  run('tar', ['-czf', outputPath, '-C', resolve(sourceDir, '..'), basename(sourceDir)])
}

function buildWrapper() {
  return `#!/usr/bin/env bash
set -euo pipefail
if ! command -v bun >/dev/null 2>&1; then
  echo "Bun is required to run claude-code-best. Install Bun from https://bun.sh/." >&2
  exit 1
fi
ROOT_DIR="$(cd "$(dirname "${'$'}0")/.." && pwd)"
ARCH="${'$'}(uname -m)"
case "${'$'}ARCH" in
  x86_64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
esac
OS="${'$'}(uname -s | tr '[:upper:]' '[:lower:]')"
RG_PATH="${'$'}ROOT_DIR/dist/vendor/ripgrep/${'$'}ARCH-${'$'}OS/rg"
if [ ! -x "${'$'}RG_PATH" ]; then
  bun "${'$'}ROOT_DIR/dist/download-ripgrep.js" >/dev/null 2>&1 || true
fi
exec bun "${'$'}ROOT_DIR/dist/cli.js" "${'$'}@"
`
}

function buildFormula(repositoryUrl: string, version: string, armSha: string, x64Sha: string) {
  return `class ClaudeCodeBest < Formula
  desc "Reverse-engineered Anthropic Claude Code CLI"
  homepage "${repositoryUrl}"
  version "${version}"
  depends_on "bun"

  on_macos do
    if Hardware::CPU.arm?
      url "${repositoryUrl}/releases/download/v${version}/ccb-v${version}-darwin-arm64.tar.gz"
      sha256 "${armSha}"
    else
      url "${repositoryUrl}/releases/download/v${version}/ccb-v${version}-darwin-x64.tar.gz"
      sha256 "${x64Sha}"
    end
  end

  def install
    libexec.install Dir["*"]
    root = libexec.children.find(&:directory?)
    raise "release root directory missing" unless root
    bin.install_symlink root/"bin/ccb"
    bin.install_symlink root/"bin/claude-code-best"
  end

  test do
    output = shell_output("#{bin}/ccb --version")
    assert_match "Claude Code", output
  end
end
`
}

async function main() {
  await ensureFile(packageJsonPath)
  await ensureFile(readmePath)
  await ensureFile(resolve(distDir, 'cli.js'))
  await ensureFile(resolve(distDir, 'download-ripgrep.js'))

  const pkg = await getPackageMetadata()
  const version = process.env.RELEASE_VERSION?.replace(/^v/, '') || pkg.version
  const repositoryUrl = pkg.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '') || ''

  await rm(releaseDir, { recursive: true, force: true })
  await mkdir(releaseDir, { recursive: true })
  await mkdir(homebrewDir, { recursive: true })

  const checksums: Array<{ file: string; sha: string }> = []
  const wrapper = buildWrapper()

  for (const platform of releasePlatforms) {
    const rootName = `ccb-v${version}-darwin-${platform.arch}`
    const stagingBase = await mkdtemp(join(tmpdir(), 'ccb-release-'))
    const stagingRoot = join(stagingBase, rootName)

    await mkdir(stagingRoot, { recursive: true })
    cpSync(distDir, join(stagingRoot, 'dist'), { recursive: true })
    await copyFile(packageJsonPath, join(stagingRoot, 'package.json'))
    await copyFile(readmePath, join(stagingRoot, 'README.md'))
    if (existsSync(licensePath)) {
      await copyFile(licensePath, join(stagingRoot, 'LICENSE'))
    }

    const binDir = join(stagingRoot, 'bin')
    await mkdir(binDir, { recursive: true })
    const ccbPath = join(binDir, 'ccb')
    const fullPath = join(binDir, 'claude-code-best')
    await writeFile(ccbPath, wrapper)
    await writeFile(fullPath, wrapper)
    await chmod(ccbPath, 0o755)
    await chmod(fullPath, 0o755)

    const archivePath = join(releaseDir, `${rootName}.tar.gz`)
    await createArchive(stagingRoot, archivePath)
    checksums.push({ file: `${rootName}.tar.gz`, sha: await sha256(archivePath) })

    await rm(stagingBase, { recursive: true, force: true })
  }

  await writeFile(
    join(releaseDir, 'SHA256SUMS'),
    `${checksums.map(item => `${item.sha}  ${item.file}`).join('\n')}\n`,
  )

  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        version,
        artifacts: checksums.map(item => item.file),
        checksumsFile: 'SHA256SUMS',
        formulaFile: 'packaging/homebrew/claude-code-best.rb',
      },
      null,
      2,
    )}\n`,
  )

  if (repositoryUrl) {
    const armSha = checksums.find(item => item.file.includes('darwin-arm64'))?.sha ?? '__SHA256_DARWIN_ARM64__'
    const x64Sha = checksums.find(item => item.file.includes('darwin-x64'))?.sha ?? '__SHA256_DARWIN_X64__'
    await writeFile(
      resolve(homebrewDir, 'claude-code-best.rb'),
      buildFormula(repositoryUrl, version, armSha, x64Sha),
    )
  }

  console.log(`Release artifacts written to ${releaseDir}`)
}

await main()
