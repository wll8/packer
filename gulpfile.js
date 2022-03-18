const fs = require(`fs`)
const shell = require(`shelljs`)
const gulp = require(`gulp`)
const packagePath = `./src/package.json`
const package = require(packagePath)
const {name, version, bin = {}} = package
const pkgName = `${name}-${version}.tgz`

gulp.task(`clear`, (cb) => { // 清理发布目录
  shell.exec(`npx shx rm -rf ./dist`)
  shell.exec(`npx shx mkdir -p ./dist/src`)
  cb()
})

gulp.task(`copy`, async (cb) => { // 复制要发布的文件
  // 生成包
  shell.exec(`cd src && npm pack && npx shx mv ${pkgName} ../dist/src/`)

  // 解压包
  const compressing = require('compressing');
  await compressing.tgz.uncompress(`./dist/src/${pkgName}`, `./dist/src/`).catch(console.log)
  
  shell.exec(`cd ./dist/src/ && npx shx rm -f ${pkgName}`)
  cb()
})


gulp.task(`ncc`, (cb) => { // 变更发布后的文件
  // ncc 需要依赖(偷懒使用符号链接)才能进行合并
  shell.exec(`npx shx ln -s ${__dirname}/src/node_modules ${__dirname}/dist/src/package/node_modules`)
  shell.exec(`npx ncc build ./dist/src/package/index.js -o ./dist/src/package/`)

  // 删除依赖声明 - 因为打包为单文件后就不需要此声明了
  package.dependencies = undefined
  package.devDependencies = undefined
  cb()
})

gulp.task(`javascript-obfuscator`, (cb) => { // 压缩
  const JavaScriptObfuscator = require('javascript-obfuscator');
  const codePath = `./dist/src/package/index.js`
  const rawCode = fs.readFileSync(codePath, `utf8`)
  const obfuscationResult = JavaScriptObfuscator.obfuscate(rawCode,
    {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 1,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 1,
      // debugProtection: true,
      // debugProtectionInterval: 4000,
      disableConsoleOutput: true,
      identifierNamesGenerator: 'hexadecimal',
      log: false,
      numbersToExpressions: true,
      renameGlobals: false,
      selfDefending: true,
      simplify: true,
      splitStrings: true,
      splitStringsChunkLength: 5,
      stringArray: true,
      stringArrayCallsTransform: true,
      stringArrayEncoding: ['rc4'],
      stringArrayIndexShift: true,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      stringArrayWrappersCount: 5,
      stringArrayWrappersChainedCalls: true,    
      stringArrayWrappersParametersMaxCount: 5,
      stringArrayWrappersType: 'function',
      stringArrayThreshold: 1,
      transformObjectKeys: true,
      unicodeEscapeSequence: false,
    }
  );
  const outCode = obfuscationResult.getObfuscatedCode()
  fs.writeFileSync(codePath, outCode)
  cb()
})


gulp.task(`pack`, (cb) => { // 打包成供发布的包
  // 删除 files, 因为打包时需要包含 dist 中的所有文件
  package.files = undefined

  fs.writeFileSync(`./dist/src/package/package.json`, JSON.stringify(package, null, 2))
  shell.exec(`cd ./dist/src/package && npm pack`)
  cb()
})

gulp.task(`test`, (cb) => { // 测试运行
  const cliName = Object.keys(bin)[0]
  const pkgPath = `${__dirname}/dist/src/package/${pkgName}`
  
  shell.exec(`cd dist && npm init -y`)
  shell.exec(`cd dist && npm i ${pkgPath}`)
  shell.exec(`cd dist && npx ${cliName}`)
  cb()
})

// see: https://github.com/gulpjs/gulp/issues/1091#issuecomment-163151632
gulp.task(
  `default`,
  gulp.series(
    `clear`,
    `copy`,
    `ncc`,
    `javascript-obfuscator`,
    `pack`,
    done => done()
  ),
)
