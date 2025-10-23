#!/usr/bin/env node
// Simple script to replace @/ui-components and @/utils imports inside this package
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', 'src', 'ui-components')

function walk(dir) {
  const files = fs.readdirSync(dir)
  files.forEach((f) => {
    const fp = path.join(dir, f)
    const stat = fs.statSync(fp)
    if (stat.isDirectory()) return walk(fp)
    if (!fp.match(/\.(js|jsx|ts|tsx)$/)) return
    let src = fs.readFileSync(fp, 'utf8')
    const before = src
    src = src.replace(/from '\@\/ui-components\//g, "from '../")
    src = src.replace(/from "\@\/ui-components\//g, 'from "../')
    src = src.replace(/from '\@\/utils\//g, "from '../utils/")
    src = src.replace(/from "\@\/utils\//g, 'from "../utils/')
    if (src !== before) {
      fs.writeFileSync(fp, src, 'utf8')
      console.log('Patched', fp)
    }
  })
}

walk(root)
