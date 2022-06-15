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

module.exports = {
  getFullLine,
  onlyLine,
}
