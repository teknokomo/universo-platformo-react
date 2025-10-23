const fs = require('fs')
const path = require('path')

const srcRoot = path.resolve(__dirname, '../src')

function walk(dir) {
  const res = []
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) res.push(...walk(full))
    else if (/\.(js|jsx|ts|tsx)$/.test(name)) res.push(full)
  }
  return res
}

const files = walk(srcRoot)

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8')
  // Remove .js/.jsx extensions from dynamic imports
  const updated = src.replace(/import\((['"])(.*?)\.jsx?\1\)/g, (match, quote, path) => {
    return `import(${quote}${path}${quote})`
  })
  
  if (updated !== src) {
    fs.writeFileSync(file, updated)
    console.log('Updated:', file)
  }
}

console.log('remove_dynamic_import_extensions: done')
