const gulp = require(`gulp`)
const del = require(`del`)
const uglify = require(`gulp-uglify-es`).default

gulp.task(`clear`, () => { // 清理发布目录
  return del([`./dist/**`, `!./dist`], { force: true })
})

gulp.task(`copy`, (cb) => { // 复制要发布的文件
  const shell = require(`shelljs`)
  const cmdList = `
    npx shx mkdir -p ./dist/src/package/
    npx shx cp ./src/index.js ./dist/src/package/
    npx shx cp ./src/package.json ./dist/src/package/
  `.split(`\n`).map(item => item.trim()).filter(item => item)
  cmdList.forEach(cmd => {
    console.log(`run: ${cmd}`)
    if(shell.exec(cmd).code !== 0) {
      new Error(`运行错误: ${cmd}`)
    }
  })
  cb()
})

gulp.task(`config`, (cb) => { // 修改发布后的文件
  const packagePath = `./dist/src/package/package.json`
  const package = require(packagePath)
  const fs = require(`fs`)
  fs.writeFileSync(packagePath, JSON.stringify(package, null, 2))
  cb()
})

gulp.task(`uglify`, () => { // js 兼容性处理
  // uglify-es - https://github.com/mishoo/UglifyJS/tree/harmony
  return gulp.src([
    `./dist/src/**/*.js`,
    `!./dist/src/node_modules/**`,
  ])
    .pipe(uglify())
    .pipe(gulp.dest(`./dist/src/package/`))
})

gulp.task(`tar`, () => { // 打包成供发布的包
  const tar = require(`tar`)
  const package = require(`./dist/src/package/package.json`)
  const filePath = `./dist/${package.name}-${package.version}.tgz`
  return tar.c( // or tar.create
    {
      gzip: true,
      cwd: `${__dirname}/dist/src/`,
      file: filePath,
    },
    [`package/`]
  )
})

gulp.task(`test`, (cb) => { // 测试运行
  const shell = require(`shelljs`)
  const packagePath = `./dist/src/package/package.json`
  const {name, version, bin = {}, main} = require(packagePath)
  const cliName = Object.keys(bin)[0]
  const pkgPath = `${__dirname}/dist/${name}-${version}.tgz`
  
  const cmdList = `
    npm init -y
    npm i ${pkgPath}
    npx ${cliName}
  `.split(`\n`).map(item => item.trim()).filter(item => item)
  cmdList.forEach(cmd => {
    console.log(`run: ${cmd}`)
    if(shell.exec(cmd, {cwd: `dist`}).code !== 0) {
      new Error(`运行错误: ${cmd}`)
    }
  })
  cb()
})

// see: https://github.com/gulpjs/gulp/issues/1091#issuecomment-163151632
gulp.task(
  `default`,
  gulp.series(
    `clear`,
    `copy`,
    `config`,
    `uglify`,
    `tar`,
    done => done()
  ),
)
