import gulp from 'gulp'

// Universo Platformo | Gulp task to copy SVG icons
function copyIcons() {
    // Copy all .svg files from base/ (and its subdirectories, like base/nodes/some_node/icon.svg or base/icons/icon.svg)
    // to dist/, preserving the directory structure relative to 'base'.
    // For example, 'base/nodes/object/object.svg' will be copied to 'dist/nodes/object/object.svg'.
    return gulp.src(['base/**/*.svg']).pipe(gulp.dest('dist'))
}

// Universo Platformo | Default Gulp task
export default gulp.series(copyIcons)
