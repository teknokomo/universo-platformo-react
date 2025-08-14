import gulp from 'gulp'

function copy() {
  return gulp
    .src(['src/**/*.svg', 'src/**/*.png', 'src/**/*.jpg', 'src/**/*.json', 'src/**/*.css'], { base: 'src' })
    .pipe(gulp.dest('dist'))
}

function copyEsm() {
  return gulp
    .src(['src/**/*.json'], { base: 'src' })
    .pipe(gulp.dest('dist/esm'))
}

export default gulp.series(copy, copyEsm)
