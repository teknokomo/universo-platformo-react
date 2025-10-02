import { src, dest, series } from 'gulp';

// Copy assets and non-TypeScript files
function copyAssets() {
    return src([
        'src/**/*.svg',
        'src/**/*.png',
        'src/**/*.jpg',
        'src/**/*.jpeg',
        'src/**/*.gif',
        'src/**/*.css',
        'src/**/*.json'
    ], { allowEmpty: true })
        .pipe(dest('dist'));
}

function copyAssetsEsm() {
    return src([
        'src/**/*.svg',
        'src/**/*.png',
        'src/**/*.jpg',
        'src/**/*.jpeg',
        'src/**/*.gif',
        'src/**/*.css',
        'src/**/*.json'
    ], { allowEmpty: true })
        .pipe(dest('dist/esm'));
}

// Default task
export default series(copyAssets, copyAssetsEsm);