import gulp from 'gulp'

// Universo Platformo | Copy static files task
function copyStaticFiles() {
    // Copy all static assets to dist folder preserving structure
    return gulp
        .src(
            [
                'src/**/*.svg', // SVG icons
                'src/**/*.png', // PNG images
                'src/**/*.jpg', // JPG images
                'src/**/*.json', // JSON data files
                'src/**/*.css' // CSS files
            ],
            {
                base: 'src'
            }
        )
        .pipe(gulp.dest('dist'))
}

// Universo Platformo | Default Gulp task
export default gulp.series(copyStaticFiles)
