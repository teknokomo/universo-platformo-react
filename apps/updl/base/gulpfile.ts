import gulp from 'gulp'

// Universo Platformo | Gulp task to copy SVG icons
function copyIcons() {
    // Copy all .svg files from src/ and all subdirectories in dist/, preserving the directory structure
    return gulp.src(['src/**/*.svg']).pipe(gulp.dest('dist'))
}

// Universo Platformo | Default Gulp task
export default gulp.series(copyIcons)
