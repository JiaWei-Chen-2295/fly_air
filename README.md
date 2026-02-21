# Fly Air

移动端优先的 3D 写实客机起飞动画项目，基于 Three.js 与后处理管线，强调贴脸飞越、电影级光影和丝滑动效。

## 功能亮点

- 写实 3D 客机与 PBR 材质贴图
- 贴脸飞越镜头与防穿模安全轨道
- 电影后处理（Bloom、景深、动感模糊、体积雾、局部光晕）
- 移动端稳定策略（抗闪烁、抗黑块、稳定像素比）

## 技术栈

- `Three.js` (`0.160.0`)
- `Vite`（本地开发与生产构建）
- `ESLint` + `Prettier`

## 快速开始

```bash
npm install
npm run dev
```

默认会启动本地开发服务器，打开控制台输出的地址即可预览。

## 常用命令

```bash
npm run dev          # 开发模式
npm run build        # 生产构建到 dist/
npm run preview      # 预览构建产物
npm run lint         # 代码规范检查
npm run format       # 自动格式化
npm run format:check # 检查格式
npm run check        # lint + build
```

## 工程目录

```text
fly_air/
  src/
    config/
      assets.js             # 静态资源路径配置
    graphics/
      cinematicShader.js    # 电影后处理 Shader
      environment.js        # 环境反射贴图
      proceduralTextures.js # 程序化纹理生成
    scene/
      world.js              # 天空/跑道/体积环境搭建
    utils/
      device.js             # 设备/视口判断
      motion.js             # 动画曲线工具
  assets/                  # 源静态资源（仅被代码 import 的文件会进入构建产物）
    models/
    textures/
  .github/workflows/ci.yml # CI: lint + build
  docs/
    ARCHITECTURE.md        # 架构与渲染管线说明
  index.html
  main.js
  styles.css
  vite.config.js
  eslint.config.js
```

## 构建与发布

1. 执行 `npm run check`
2. 执行 `npm run build`
3. 部署 `dist/` 目录到静态站点服务（Nginx、Vercel、Netlify、OSS 静态托管均可）

## CI

- 已内置 GitHub Actions：`.github/workflows/ci.yml`
- 在 Push / PR 时自动执行 `npm ci`、`npm run lint`、`npm run build`

## 说明

- 静态资源通过 `src/config/assets.js` 模块化导入（Vite 会输出带 hash 的资源 URL）
- 仅运行时真实引用的资源会进入 `dist/`，避免无关素材增大包体积
- `main.js` 仍作为入口编排文件，核心工具能力已拆分到 `src/` 模块
- `ddg_aircraft.html` 是历史参考文件，不参与构建流程

详细设计请看 `docs/ARCHITECTURE.md`。
