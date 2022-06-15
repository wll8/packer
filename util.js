const fs = require(`fs`)
const os = require(`os`)
const path = require(`path`)
const shell = require(`shelljs`)

/**
 * 以单行形式输出文本到终端
 * @param {string} str 要输出的字符
 */
function onlyLine(str) {
  const columns = process.stdout.columns // 终端字符宽度
  str = str.length > columns ? str : ` `.repeat(columns).replace(new RegExp(`.{${str.length}}`), str) // 以空格补齐整行终端, 避免其他字符侵入本行
  process.stdout.write(`\r${str}`)
}

/**
 * 获取与终端大小相同的字符串
 * @param {string} arg.str 要输出的字符
 * @param {string} arg.name 在字符中嵌入文本
 * @returns {string}
 */
function getFullLine({str = `=`, name = `=`} = {}) {
  const size = (process.stdout.columns || 80) - 1 // 给换行符让位
  const repeat = str.repeat(size)
  const newName = `${str.repeat(5)}${name}`
  const newRepeat = repeat.replace(new RegExp(`^.{${newName.length}}`), newName)
  return newRepeat
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
 * inputDir 包路径
 * outDir 输出路径, 如果不传则只返回包信息
 */
async function getPackFile(inputDir, outDir) {
  const package = require(`${inputDir}/package.json`)
  const packName = `${package.name}-${package.version}.tgz`
  const packPath = `${inputDir}/${packName}`
  const tempDir = path.normalize(`${os.tmpdir()}/${Date.now()}/`)
  
  if(outDir) {
    shell.exec(`cd ${inputDir} && npm pack`)
    const compressing = require('compressing')
    await compressing.tgz.uncompress(packPath, tempDir).catch(console.log)
    shell.exec(`npx shx rm -f ${packPath}`)
    shell.exec(`npx shx cp -r ${tempDir}/package ${outDir}`)
  }
  return {
    packName,
    package,
  }
}


/**
 * 压缩代码
 * arg.codePath 代码路径
 * arg.cfg 参数配置
 */
function compress({codePath, cfg}) {
  const JavaScriptObfuscator = require('javascript-obfuscator');
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
      ...cfg,
    }
  );
  const outCode = obfuscationResult.getObfuscatedCode()
  fs.writeFileSync(codePath, outCode)
}

module.exports = {
  compress,
  getPackFile,
  parseArgv,
  getFullLine,
  onlyLine,
}
