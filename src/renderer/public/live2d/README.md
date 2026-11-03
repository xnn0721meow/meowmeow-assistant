# Live2D 可选资源

内置形象始终可用；放入下面两类文件后，应用会自动切换到 Live2D 模型。

## 1. Cubism Core

从 [Live2D Cubism SDK for Web](https://www.live2d.com/download/cubism-sdk/download-web/) 下载，把
`live2dcubismcore.min.js` 放到：

```text
src/renderer/public/live2d/core/live2dcubismcore.min.js
```

Cubism Core 是 Live2D Inc. 的专有可再分发代码，不属于本项目 MIT 许可范围。使用前请阅读并遵守
Live2D 的 SDK 发布许可条款；个人/小规模发布一般免许可费（Expandable Application 除外）。

## 2. 模型

把模型目录放进：

```text
src/renderer/public/live2d/models/<model-name>/
```

确保目录里包含 `.model3.json` 以及它引用的贴图、动作、物理文件。然后在设置页的
“Live2D 模型路径”里填写：

```text
/live2d/models/<model-name>/<model-name>.model3.json
```

模型文件默认被 `.gitignore` 排除，请不要把没有授权的模型提交到公开仓库。

## 说明

- 目前使用 Cubism 3/4/5 的 `model3.json` 路线；Cubism 2.1 需要额外的 `live2d.min.js` 运行时。
- 模型加载失败时，应用会自动回退到内置 SVG 形象，并在桌宠下方显示提示。
- 本项目不附带任何第三方模型；请使用自己制作或已获授权的模型。
