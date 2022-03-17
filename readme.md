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
- [ ] feat: 使用 npm pack 来打包, 这样比较符合规范.
  - 使用此方案后, task 中的 copy/config/uglify 都需要做相应的调整
  - npm pack 打包
  - 再解包到 dist 目录
  - 再对 dist 做其他自定义处理, 例如版本转换
  - 处理完成后使用 dist 中的文件来打包为最终产物