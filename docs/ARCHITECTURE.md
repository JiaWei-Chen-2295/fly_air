# 架构说明

## 1. 总体结构

项目采用单页面入口 + 模块化脚本结构：

- `index.html`：页面结构与 Canvas 挂载
- `main.js`：入口编排（初始化、串联各模块）
- `src/config/assets.js`：资源路径配置
- `src/graphics/*`：Shader、程序化纹理、环境图
- `src/scene/world.js`：天空/地面/灯光/云层与体积氛围
- `src/utils/*`：设备判断与运动曲线工具
- `styles.css`：UI 覆层与移动端布局

构建层由 Vite 提供：

- 开发：热更新 + ES 模块
- 生产：压缩打包到 `dist/`
- 静态资源：通过 `src/config/assets.js` 显式 `import`，仅打包运行时实际引用文件

## 2. 渲染管线

核心渲染顺序：

1. `RenderPass`（场景基础渲染）
2. `UnrealBloomPass`（高光扩散）
3. 自定义 `ShaderPass`（电影效果：运动模糊、色差、颗粒、体积雾、局部光晕）
4. `BokehPass`（按策略启停）
5. `SMAAPass`（抗锯齿，按档位启停）
6. `OutputPass`

## 3. 动画系统

采用统一时间轴 `t`（循环）驱动：

- `rush / liftoff / overfly / climb`：阶段化运动
- `nearPass / passShock / flybyWindow`：贴脸段控制信号
- 通过 `THREE.MathUtils.damp` 实现平滑阻尼，避免镜头与光影抖动

## 4. 稳定性策略（移动端重点）

为避免闪屏、黑块、近距穿帮，主要策略：

- 关闭运行时动态画质切换（防止中途重建渲染目标造成闪烁）
- 限制移动端像素比上限
- 贴脸段自动压低冲击参数（曝光、震动、动模糊）
- `BokehPass` 在高风险窗口自动抑制
- 飞越镜头启用安全偏移逻辑，防止机腹穿近裁剪面

## 5. 光影策略

- 场景雾 `FogExp2` 动态调节密度
- 体积雾层（Sprite）参与飞越阶段变化
- 局部光晕基于机腹位置投影到屏幕空间，增强“擦脸”质感

## 6. 资源管理

模型与贴图源文件位于：

- `assets/models/*.glb`
- `assets/textures/painted_metal_002/*`

在运行时：

- PBR 贴图异步加载并统一 wrap/repeat/anisotropy
- GLB 加载失败时回退程序化机体模型

## 7. 质量档位逻辑

`postTier` 控制后处理强度：

- `2`：高质量（完整后处理）
- `1`：平衡模式（适中景深与动模糊）
- `0`：性能模式（禁用高成本通道）

项目当前默认关闭自动档位切换，优先稳定观感。

## 8. 工程化现状与下一步

当前已完成：

- 模块拆分（`config / graphics / utils`）
- 统一构建（Vite）
- 代码规范（ESLint + Prettier）
- CI（GitHub Actions 自动执行 lint + build）

建议下一步：

- 继续将 `main.js` 拆分到 `scene/`、`animation/`、`postfx/` 模块
- 引入 TypeScript 与类型约束
- 为关键函数补充单测（时间轴函数、质量档位函数）
