import gulp from 'gulp'

// Universo Platformo | Copy static files task
function copyStaticFiles() {
    return gulp.src(['src/**/*.svg', 'src/**/*.png', 'src/**/*.jpg', 'src/**/*.json', 'src/**/*.css'], { base: 'src' }).pipe(gulp.dest('dist'))
}

export default gulp.series(copyStaticFiles)
