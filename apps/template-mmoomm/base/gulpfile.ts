import gulp from 'gulp'

// Universo Platformo | MMOOMM Template - Copy static files task
function copyStaticFiles() {
    // Copy any static assets to dist folder preserving structure
    return gulp
        .src(
            [
                'src/**/*.json', // JSON configuration files
                'src/**/*.md'    // Documentation files
            ],
            {
                base: 'src'
            }
        )
        .pipe(gulp.dest('dist'))
}

// Universo Platformo | MMOOMM Template - Default Gulp task
export default gulp.series(copyStaticFiles)
