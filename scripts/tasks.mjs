import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
const win = process.platform === 'win32'

function run(command, args = [], cwd = root) {
  console.log(`> ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, PWD: cwd, INIT_CWD: cwd },
    stdio: 'inherit',
    shell: win && /\.(cmd|bat)$/.test(command),
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function bin(name, args) {
  run(path.join(root, 'node_modules', '.bin', name + (win ? '.cmd' : '')), args)
}

function maven(...args) {
  run(
    win ? 'mvnw.cmd' : 'sh',
    [
      ...(win ? [] : ['./mvnw']),
      '--batch-mode',
      '--no-transfer-progress',
      ...args,
    ],
    path.join(root, 'backend'),
  )
}

function generate(check = false) {
  const output = path.join(root, '.generated')
  rmSync(output, { recursive: true, force: true })
  mkdirSync(output, { recursive: true })
  bin('tsp', ['compile', 'contracts', '--output-dir', '.generated'])
  bin('openapi-generator-cli', [
    '--openapitools',
    path.join(root, 'openapitools.json'),
    'generate',
    '-i',
    '.generated/openapi.yaml',
    '-g',
    'typescript-fetch',
    '-o',
    '.generated/sdk',
    '--global-property',
    'apis,models,supportingFiles=runtime.ts:index.ts,apiDocs=false,modelDocs=false',
    '--additional-properties',
    'supportsES6=true,hideGenerationTimestamp=true',
  ])
  normalizeGenerated(path.join(output, 'sdk'))
  const sdk = path.join(root, 'frontend/src/api')
  const spec = path.join(root, 'contracts/openapi.yaml')
  if (check) {
    if (
      !existsSync(spec) ||
      !readFileSync(spec).equals(
        readFileSync(path.join(output, 'openapi.yaml')),
      )
    ) {
      throw new Error('OpenAPI is stale. Run mise run generate.')
    }
    if (
      JSON.stringify(tree(sdk)) !==
      JSON.stringify(tree(path.join(output, 'sdk')))
    ) {
      throw new Error('SDK is stale. Run mise run generate.')
    }
  } else {
    cpSync(path.join(output, 'openapi.yaml'), spec)
    rmSync(sdk, { recursive: true, force: true })
    cpSync(path.join(output, 'sdk'), sdk, { recursive: true })
  }
}

function normalizeGenerated(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) normalizeGenerated(file)
    else if (entry.name.endsWith('.ts')) {
      writeFileSync(
        file,
        readFileSync(file, 'utf8')
          .replace(/[ \t]+$/gm, '')
          .trimEnd() + '\n',
      )
    }
  }
}

function tree(dir) {
  if (!existsSync(dir)) return null
  return Object.fromEntries(
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => [
        entry.name,
        entry.isDirectory()
          ? tree(path.join(dir, entry.name))
          : readFileSync(path.join(dir, entry.name), 'utf8').replaceAll(
              '\r\n',
              '\n',
            ),
      ]),
  )
}

function lintSources() {
  bin('eslint', ['frontend', 'scripts'])
  bin('prettier', ['--check', '.'])
  run('actionlint', ['-shellcheck=', '-pyflakes='])
}

const task = process.argv[2]
switch (task) {
  case 'generate':
    generate()
    break
  case 'lint':
    lintSources()
    maven('checkstyle:check')
    break
  case 'lint:commit':
    lintSources()
    maven('--offline', 'checkstyle:check')
    break
  case 'test':
    maven('test')
    break
  case 'build':
    run(win ? 'npm.cmd' : 'npm', ['run', 'build', '--workspace', 'frontend'])
    maven('package', '-DskipTests')
    break
  case 'check':
    generate(true)
    lintSources()
    run(win ? 'npm.cmd' : 'npm', ['run', 'build', '--workspace', 'frontend'])
    maven('verify')
    break
  case 'backend':
    maven('spring-boot:run')
    break
  case 'frontend':
    run(win ? 'npm.cmd' : 'npm', ['run', 'dev', '--workspace', 'frontend'])
    break
  default:
    throw new Error(`Unknown task: ${task}`)
}
