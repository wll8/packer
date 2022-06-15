const fs = require(`fs`)
const shell = require(`shelljs`)
const util = require(`./util.js`)
const packagePath = `./src/package.json`
const package = require(packagePath)
const {name, version, bin = {}} = package
const packName = `${name}-${version}.tgz`

const argv = parseArgv()
console.log(`argv`, argv)

/**
 * 清理发布目录
 */
function clear() {
  shell.exec(`npx shx rm -rf ./dist`)
  shell.exec(`npx shx mkdir -p ./dist`)
}

/**
 * 处理为单文件
 */
function ncc() {
  // ncc 需要依赖(偷懒使用符号链接)才能进行合并
  shell.exec(`npx shx ln -s ${__dirname}/src/node_modules ${__dirname}/dist/package/node_modules`)
  shell.exec(`npx ncc build ./dist/package/index.js -o ./dist/package/`)
  // 移除 node_modules
  shell.exec(`npx shx rm -rf ${__dirname}/dist/package/node_modules`)

  // 删除依赖声明 - 因为打包为单文件后就不需要此声明了
  package.dependencies = undefined
  package.devDependencies = undefined
}

/**
 * 压缩
 */
function compress() {
  const JavaScriptObfuscator = require('javascript-obfuscator');
  const codePath = `./dist/package/index.js`
  const rawCode = fs.readFileSync(codePath, `utf8`)

  // see: https://github.com/javascript-obfuscator/javascript-obfuscator#high-obfuscation-low-performance
  const obfuscationResult = JavaScriptObfuscator.obfuscate(rawCode,
    {
      compact: true, // 压缩为一行
      controlFlowFlattening: true, // 改变代码结构, 会让程序变慢
      controlFlowFlatteningThreshold: 1,
      deadCodeInjection: true, // 添加混淆
      deadCodeInjectionThreshold: 1,
      // debugProtection: true, // 开启循环 debug 阻碍调试
      // debugProtectionInterval: 4000,
      disableConsoleOutput: true, // 禁止输出 console.xxx 日志
      identifierNamesGenerator: 'hexadecimal', // 转换字符串为 16 进制
      log: false, // 禁止输出 console.log
      numbersToExpressions: true, // 转换数字为表达式
      renameGlobals: false, // 混淆全局变量
      selfDefending: true, // 自我防御
      simplify: true, // 以简写方式混淆
      splitStrings: true, // 分割字面量的字符串
      splitStringsChunkLength: 5,
      stringArray: true, // 分割字面量到数组
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
      transformObjectKeys: true, // 转换对象的 key
      unicodeEscapeSequence: false, // 转换字符串为 Unicode
    }
  );
  const outCode = obfuscationResult.getObfuscatedCode()
  fs.writeFileSync(codePath, outCode)
}

/**
 * 打包成供发布的包
 */
function pack() {
  /**
   * 处理为单文件的过程中可能会首先未知文件, 由于不得不把他们包虑到发布代码中, 所以需要重置 files
   * https://github.com/vercel/ncc/issues/893
   */
  package.files = undefined

  fs.writeFileSync(`./dist/package/package.json`, JSON.stringify(package, null, 2))
  shell.exec(`cd ./dist/package && npm pack`)
  shell.exec(`npx shx mv ./dist/package/${packName} ./dist/`)
}

/**
 * 测试运行
 */
function test() {
  const cliName = Object.keys(bin)[0]
  const pkgPath = `${__dirname}/dist/${packName}`
  
  shell.exec(`cd dist && npm init -y`)
  shell.exec(`cd dist && npm i ${pkgPath}`)
  shell.exec(`cd dist && npx ${cliName}`)
}

/**
 * 混入到某个包
 */
async function minxin(name = `shelljs`) {
  const { package, packName } = await getPackFile(`./node_modules/${name}/`, `./dist/${name}/`)
  shell.exec(`npx shx cp -rf ./dist/package ./dist/${name}/_minxin`)
  package.bin = {
    ...package.bin,
    ...Object.entries(bin).reduce((acc, [key, val]) => {
      acc[key] = `./_minxin/index.js`
      return acc
    }, {}),
  }
  package.files = [
    ...package.files,
    `_minxin`,
  ]
  fs.writeFileSync(`./dist/${name}/package.json`, JSON.stringify(package, null, 2))
  shell.exec(`cd ./dist/${name}/ && npm pack && npx shx mv ${packName} ../`)
}

function parseArgv(arr) { // 解析命令行参数
  return (arr || process.argv.slice(2)).reduce((acc, arg) => {
    let [k, ...v] = arg.split(`=`)
    v = v.join(`=`) // 把带有 = 的值合并为字符串
    acc[k] = v === `` // 没有值时, 则表示为 true
      ? true
      : (
        /^(true|false)$/.test(v) // 转换指明的 true/false
        ? v === `true`
        : (
          /[\d|.]+/.test(v)
          ? (isNaN(Number(v)) ? v : Number(v)) // 如果转换为数字失败, 则使用原始字符
          : v
        )
      )
    return acc
  }, {})
}

/**
 * 提取指定包的文件到某目录
 */
async function getPackFile(inputDir, outDir) {
  const path = require(`path`)
  const os = require(`os`)
  const package = require(`${inputDir}/package.json`)
  const packName = `${package.name}-${package.version}.tgz`
  const packPath = `${inputDir}/${packName}`
  const tempDir = path.normalize(`${os.tmpdir()}/${Date.now()}/`)
  
  shell.exec(`cd ${inputDir} && npm pack`)
  const compressing = require('compressing')
  await compressing.tgz.uncompress(packPath, tempDir).catch(console.log)
  shell.exec(`npx shx rm -f ${packPath}`)
  
  shell.exec(`npx shx cp -r ${tempDir}/package ${outDir}`)
  return {
    packName,
    package,
  }
}

const task = new Proxy({
  clear,
  getPackFile,
  ncc,
  compress,
  pack,
  minxin,
  test,
}, {
  get(obj, key) {
    return (...arg) => {
      const timeLable = util.getFullLine({name: `task-time ${key}`})
      return new Promise(async (resolve, reject) => {
        console.time(timeLable)
        try {
          resolve(await obj[key](...arg))
        } catch (error) {
          reject(error)
        }
        console.timeEnd(timeLable)
      })
    }
  }
})

async function build() {
  if(argv[`--run`]) {
    await Promise.all(argv[`--run`].split(`,`).map(name => task[name]()))
  } else {
    await task.clear()
    await task.getPackFile()
    await task.ncc()
    await task.compress()
    await task.pack()
    argv.minxin && await task.minxin(argv.minxin)
    argv.test && await task.test()
  }
}

build()