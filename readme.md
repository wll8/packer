一个 cli 工具初始化模板.

``` sh
# 安装依赖
npm i

# 在 src/index.js 编写你的 cli 代码.

# 打包
npm run build

# 测试打包后的文件
npm run build:test
```

如果打包 src 中的其他文件, 需要在 gulpfile 中的 copy 任务中自行添加.

## todo
- [x] feat: 使用 npm pack 进行打包
- [x] feat: 打包为单文件
- [x] feat: 压缩
- [ ] feat: gulp 支持传参选择任务
- [ ] feat: 封装为打包工具, 便于打包任意项目
- [ ] feat: 支持参数
  - --input 要打包的依赖, 默认 ./
  - --out 输出位置, 默认 ./
  - --alone 合并为单文件, 默认 true
  - --encode 编码, 默认 true
  - --encode--package 编码 package, 默认 false
  - --obfuscator--xxx javascript-obfuscator 选项, 例如 --obfuscator--compact
  - --minxin 混入 bin 到某个 package