import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const temporary = mkdtempSync(path.join(tmpdir(), 'calendar-e2e-'))
const database = path.join(temporary, 'calendar').replaceAll('\\', '/')
const fixture = path
  .join(root, 'backend/src/test/resources/catalog-fixture.sql')
  .replaceAll('\\', '/')
const server = spawn(
  'java',
  [
    '-jar',
    path.join(root, 'backend/target/e2e/calendar.jar'),
    '--server.port=0',
    '--spring.profiles.active=e2e',
    `--spring.datasource.url=jdbc:h2:file:${database};LOCK_TIMEOUT=5000`,
    '--spring.sql.init.mode=always',
    `--spring.sql.init.data-locations=file:${fixture}`,
  ],
  { cwd: temporary, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
)
let output = ''
const stopped = new Promise((resolve) => server.once('close', resolve))
const interrupted = () => server.kill()
process.once('SIGINT', interrupted)
process.once('SIGTERM', interrupted)

try {
  const baseURL = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('E2E server startup timed out')),
      60000,
    )
    server.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    server.once('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`E2E server exited: ${code}`))
    })
    function collect(data) {
      output += data.toString()
      const match = output.match(/Tomcat started on port (\d+)/)
      if (match) {
        clearTimeout(timeout)
        resolve(`http://127.0.0.1:${match[1]}`)
      }
    }
    server.stdout.on('data', collect)
    server.stderr.on('data', collect)
  })
  console.log(`E2E server: ${baseURL}; isolated database: ${database}`)
  const browser = spawn(
    process.execPath,
    [path.join(root, 'node_modules/@playwright/test/cli.js'), 'test'],
    {
      cwd: root,
      windowsHide: true,
      stdio: 'inherit',
      env: { ...process.env, E2E_BASE_URL: baseURL },
    },
  )
  const code = await new Promise((resolve, reject) => {
    browser.once('error', reject)
    browser.once('close', resolve)
  })
  process.exitCode = code ?? 1
} catch (error) {
  console.error(output)
  console.error(error)
  process.exitCode = 1
} finally {
  server.kill()
  await stopped
  process.removeListener('SIGINT', interrupted)
  process.removeListener('SIGTERM', interrupted)
  rmSync(temporary, { recursive: true, force: true })
  console.log('E2E server stopped; temporary database removed')
}
