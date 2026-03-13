const { spawnSync } = require('child_process')

const forwardedArgs = process.argv.slice(2)
const normalizedArgs = []
let strippedSeparator = false

for (const arg of forwardedArgs) {
  if (!strippedSeparator && arg === '--') {
    strippedSeparator = true
    continue
  }
  normalizedArgs.push(arg)
}

const jestBin = require.resolve('jest/bin/jest')
const result = spawnSync(process.execPath, [jestBin, ...normalizedArgs], {
  env: process.env,
  stdio: 'inherit'
})

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)