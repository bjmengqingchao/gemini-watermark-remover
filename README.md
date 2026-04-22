<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 🍌 Nanobanana / Gemini 水印移除工具

一个基于浏览器的工具，用于自动移除 Gemini AI 生成图片中的水印。所有处理均在本地完成，无需上传图片到远程服务器，保护您的隐私。

## ✨ 功能特点

- 🚀 **完全本地处理**：图片处理在您的浏览器中进行，无需上传到任何服务器
- 🎨 **智能水印检测**：自动识别 Gemini AI 图片中的水印位置和样式
- ⚙️ **可调参数**：
  - **水印层数**：支持 1-3 层水印叠加去除
  - **去除强度**：可调节的 alpha 增益参数，控制水印去除的强度
- 📱 **响应式设计**：适配各种屏幕尺寸，从桌面到移动设备
- 🖼️ **多格式支持**：支持 PNG、JPG、WebP 等常见图片格式
- ⚡ **快速处理**：利用现代浏览器 Canvas API 实现高效图像处理
- 🔒 **隐私保护**：所有操作均在本地完成，图片不会离开您的设备

## 🚀 快速开始

### 前置要求

- Node.js 18.0 或更高版本
- 现代浏览器（Chrome 90+、Firefox 88+、Safari 14+）

### 安装与运行

1. **克隆仓库**
   ```bash
   git clone https://github.com/bjmengqingchao/gemini-watermark-remover.git
   cd gemini-watermark-remover
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**（可选）
   复制 `.env.example` 文件为 `.env.local`：
   ```bash
   cp .env.example .env.local
   ```
   编辑 `.env.local` 文件，设置您的 Gemini API 密钥（如需使用其他 AI Studio 功能）：
   ```env
   GEMINI_API_KEY="您的_Gemini_API_密钥"
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

5. **打开浏览器**
   访问 `http://localhost:3000` 开始使用

## 🎯 使用方法

### 基本使用

1. **上传图片**
   - 点击上传区域或直接将图片拖拽到页面中
   - 支持 PNG、JPG、WebP 格式的图片

2. **调整参数**（可选）
   - **水印层数**：根据水印叠加情况选择 1、2 或 3 层
   - **去除强度**：拖动滑块调整去除强度（0.5 - 2.0）

3. **下载结果**
   - 处理完成后，点击下载按钮保存无水印图片
   - 默认保存为 `gemini-no-watermark.png`

### 参数说明

| 参数 | 说明 | 默认值 | 范围 |
|------|------|--------|------|
| 水印层数 | 水印叠加的层数 | 1 | 1-3 |
| 去除强度 | 控制水印去除的强度 | 1.0 | 0.5-2.0 |

### 使用技巧

- **复杂水印**：如果水印较深或有多层叠加，尝试增加水印层数
- **轻微残留**：适当增加去除强度，但避免过高导致图片失真
- **最佳效果**：对于标准的 Gemini AI 生成图片，使用默认参数即可获得良好效果

## 🛠️ 技术架构

### 核心技术

- **React 19**：前端框架
- **TypeScript**：类型安全的开发体验
- **Vite**：快速的构建工具和开发服务器
- **Canvas API**：浏览器原生图像处理
- **Tailwind CSS**：现代化的 CSS 框架

### 水印去除算法

工具采用基于 Alpha 通道分析的水印去除算法：

1. **水印定位**：根据图片尺寸自动检测水印位置
2. **Alpha 映射**：分析水印区域的透明度信息
3. **像素修复**：根据 Alpha 值重建原始像素
4. **多层处理**：支持多层水印叠加的数学建模

### 项目结构

```
gemini-watermark-remover/
├── src/
│   ├── App.tsx              # 主应用组件
│   ├── main.tsx             # 应用入口点
│   ├── index.css            # 全局样式
│   └── lib/
│       └── watermark.ts     # 水印去除核心算法
├── public/                  # 静态资源
├── index.html               # HTML 入口文件
├── vite.config.ts           # Vite 配置
├── tsconfig.json            # TypeScript 配置
├── package.json             # 项目依赖
└── README.md                # 本文档
```

## 📦 构建与部署

### 开发模式

```bash
npm run dev
```

### 生产构建

```bash
npm run build
```

构建后的文件位于 `dist/` 目录。

### 预览构建结果

```bash
npm run preview
```

### 部署到 AI Studio

此项目兼容 Google AI Studio，可直接部署：

1. 在 AI Studio 中创建新应用
2. 上传项目文件
3. 配置环境变量
4. 部署到 Cloud Run

### 静态部署

由于是纯前端应用，您可以部署到任何静态托管服务：

- **Vercel**：`vercel deploy`
- **Netlify**：`netlify deploy`
- **GitHub Pages**：配置 GitHub Actions 自动部署
- **Cloudflare Pages**：支持边缘部署

## 🔧 配置选项

### 环境变量

| 变量名 | 说明 | 必需 | 默认值 |
|--------|------|------|--------|
| `GEMINI_API_KEY` | Gemini API 密钥 | 否 | - |
| `APP_URL` | 应用 URL | 否 | 开发服务器地址 |

### 构建配置

可在 `vite.config.ts` 中调整：

- 端口号
- 主机设置
- 代理配置
- 构建优化选项

## 🤝 贡献指南

我们欢迎任何形式的贡献！

### 开发流程

1. **Fork 仓库**
2. **创建功能分支**
   ```bash
   git checkout -b feature/新功能
   ```
3. **提交更改**
   ```bash
   git commit -m "添加: 新功能描述"
   ```
4. **推送分支**
   ```bash
   git push origin feature/新功能
   ```
5. **创建 Pull Request**

### 代码规范

- 使用 TypeScript 并启用严格模式
- 遵循现有的代码风格
- 添加必要的注释和文档
- 确保代码通过 ESLint 检查

### 提交信息规范

使用约定式提交：
- `feat:` 新功能
- `fix:` 修复问题
- `docs:` 文档更新
- `style:` 代码样式调整
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建或工具更新

## 🐛 常见问题

### Q: 为什么处理后的图片有水印残留？
**A:** 尝试增加水印层数或调整去除强度。某些复杂水印可能需要手动调整参数。

### Q: 支持其他 AI 平台的水印吗？
**A:** 目前专为 Gemini AI 水印优化。其他平台的水印可能需要调整算法参数。

### Q: 图片会上传到服务器吗？
**A:** 不会。所有处理均在您的浏览器本地完成，确保隐私安全。

### Q: 支持批量处理吗？
**A:** 当前版本支持单张图片处理。批量处理功能正在开发中。

### Q: 如何处理大尺寸图片？
**A:** 工具会自动根据图片尺寸选择合适的水印检测参数，支持最大 4096x4096 的图片。

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- **Google Gemini AI**：提供强大的 AI 生成能力
- **React 团队**：优秀的前端框架
- **Vite 团队**：快速的开发体验
- **所有贡献者**：感谢您的支持和贡献

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- **GitHub Issues**：报告问题或功能请求
- **Pull Requests**：提交代码贡献
- **讨论区**：分享使用经验

---

<div align="center">
感谢使用 Nanobanana / Gemini 水印移除工具！🎉
</div>