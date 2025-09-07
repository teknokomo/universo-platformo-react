import gulp from 'gulp'

function copyStaticFiles() {
    return gulp
        .src(['src/**/*.svg', 'src/**/*.png', 'src/**/*.jpg', 'src/**/*.json', 'src/**/*.css'], { base: 'src' })
        .pipe(gulp.dest('dist'))
        .pipe(gulp.dest('dist/esm'))
}

export default gulp.series(copyStaticFiles)
