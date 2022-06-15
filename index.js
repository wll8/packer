const fs = require(`fs`)
const shell = require(`shelljs`)
const util = require(`./util.js`)
const packagePath = `./src/package.json`
const package = require(packagePath)
const {name, version, bin = {}} = package
const packName = `${name}-${version}.tgz`

const argv = util.parseArgv()
const query = (function () {
  const sourceCode = arguments.callee.toString()
  return {
    ...argv,
    '--input': argv[`--input`] ?? `./`, // 要打包的依赖, 默认 ./
    '--out': argv[`--out`] ?? `./`, // 输出位置, 默认 ./
    '--ncc': argv[`--ncc`] ?? true, // 合并为单文件, 默认 true
    '--compress': argv[`--compress`] ?? true, // 压缩, 默认 true
    '--compress-x': argv[`--compress-x`] ?? ``, // 压缩选项, 例如 --compress-splitStrings=true
    '--minxin': argv[`--minxin`] ?? ``, // 混入 bin 到某个 package, 例如 --minxin=shelljs
    get '--help' () {
      const matchAll = [...sourceCode.matchAll(/: argv\[`(.+?)`] \?\? (.+?), \/\/ (.*)/g)]
      const str = matchAll.reduce((acc, [, key, val, desc]) => {
        return acc + `${key}=${val} ${desc}\n`
      }, ``)
      return str
    },
  }
})();


if(argv[`--help`]) {
  console.log(query[`--help`])
  process.exit()
}

if(query[`--compress`]) {
  query[`--compress`] = Object.entries(query).reduce((acc, [key, val]) => {
    const newKey = key.replace(`--compress-`, ``)
    if(newKey !== key) {
      acc[newKey] = val
      delete query[key]
    }
    return acc
  }, {})
}

console.log(`命令行参数>> `, query)

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
async function test(minxin) {
  const cliName = Object.keys(bin)[0]
  const cmd = `npx ${cliName}`
  let pkgPath = ``
  if(minxin) {
    const { packName } = await util.getPackFile(`./node_modules/${minxin}/`)
    pkgPath = `${__dirname}/dist/${packName}`
  } else {
    pkgPath = `${__dirname}/dist/${packName}`
  }
  shell.exec(`cd dist && npm init -y`)
  shell.exec(`cd dist && npx cnpm i -S ${pkgPath}`)
  shell.exec(`cd dist && ${cmd}`)
}

/**
 * 混入 package 文件到宿主包
 * name 宿主包名称
 */
async function minxin(name = `shelljs`) {
  // 提取宿主
  const { package, packName } = await util.getPackFile(`./node_modules/${name}/`, `./dist/${name}/`)
  // 在宿主中注入文件
  shell.exec(`npx shx cp -rf ./dist/package ./dist/${name}/_minxin`)
  package.files = [
    ...package.files,
    `_minxin`,
  ]
  // 在宿主中注入命令
  package.bin = {
    ...package.bin,
    ...Object.entries(bin).reduce((acc, [key, val]) => {
      acc[key] = `./_minxin/${val}`
      return acc
    }, {}),
  }
  // 更新宿主信息
  fs.writeFileSync(`./dist/${name}/package.json`, JSON.stringify(package, null, 2))
  // 输出变更后的宿主
  shell.exec(`cd ./dist/${name}/ && npm pack && npx shx mv ${packName} ../`)
}

const task = new Proxy({
  clear,
  getPackFile: util.getPackFile,
  ncc,
  compress: util.compress,
  pack,
  minxin,
  test,
}, {
  get(obj, key) {
    return () => {
      const arg = {
        test: [query[`--minxin`]],
        getPackFile: [`./src/`, `./dist/package`],
        minxin: [query[`--minxin`]],
        compress: [
          {
            codePath: `./dist/package/index.js`,
            cfg: query[`--compress`],
          },
        ],
      }[key] || []
      const timeLable = util.getFullLine({name: [
        `task-time ${key}`,
        arg.length && ` arg: ${arg.join(`, `)}`,
      ].filter(_ => _).join(``)})
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
  if(query[`--run`]) {
    await Promise.all(query[`--run`].split(`,`).map(name => task[name]()))
  } else {
    await task.clear()
    await task.getPackFile()
    query[`--ncc`] && await task.ncc()
    query[`--compress`] && await task.compress()
    await task.pack()
    query[`--minxin`] && await task.minxin()
    query[`--test`] && await task.test()
  }
  process.exit()
}

build()