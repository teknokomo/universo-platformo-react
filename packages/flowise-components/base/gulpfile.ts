const { src, dest } = require('gulp')

/**
 * Copy node icons (jpg, png, svg) from source to dist folder.
 * This is needed because TypeScript compiler doesn't copy non-ts files.
 */
function copyIcons() {
    return src(['nodes/**/*.{jpg,png,svg}']).pipe(dest('dist/nodes'))
}

exports.default = copyIcons
