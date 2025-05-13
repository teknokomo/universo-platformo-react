import gulp from 'gulp'

// Universo Platformo | Copy static files task
function copyStaticFiles() {
    // Copy non-TS files to the dist directory
    // For example, JSON schema files, templates, etc.
    return gulp
        .src(['src/**/*.json', 'src/**/*.html', 'src/**/*.schema', 'src/**/*.template'], {
            base: 'src'
        })
        .pipe(gulp.dest('dist'))
}

// Universo Platformo | Default Gulp task
export default gulp.series(copyStaticFiles)
