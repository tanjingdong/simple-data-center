![License](https://img.shields.io/badge/license-MIT-green)

<a href="https://longhabit.com"><img src="https://longhabit.com/og-image.png" /></a>

# Long Habit

Long Habit 是一个用于追踪长期习惯和周期性任务的简单 CRUD 应用。它是一个基于 PocketBase 和 React 构建的生产级全栈项目,是集成 PocketBase 到大型 Go 项目并将其与现代 React 前端结合的综合性示例。应用程序非常简单,可以作为新项目的模板。大部分样板配置已处理完毕,常见问题已被发现并修复。

在线体验:https://longhabit.com

## 主要特性

### 后端架构
- 运行最新版 Pocketbase (v0.39)。
- 单二进制构建。使用 Go 的 "embed" 包将 React 前端作为文件系统嵌入编译后的二进制文件中。
- PocketBase 以 Go 包形式安装并作为框架使用。项目使用了许多扩展特性,包括:
  - 自定义 hooks 和中间件
  - 路由绑定
  - 数据库操作
  - 带 cron 的定时任务
  - HTML 邮件模板
  - 自定义日志配置
- 使用 Pond 库实现的批量邮件处理 worker pool
- 惯用的 Go 代码组织,职责分离清晰

### 前端实现
- 使用 TypeScript 和 Vite 构建的现代 React 配置。
- 基于 React 19 构建,支持 React Compiler。
- 完整配置 TailwindCSS 与 ShadCN UI,带自定义主题。
- 采用最佳实践实现响应式设计,支持浅色和深色模式,已在桌面和移动端测试。
- 完整的认证流程,带自定义表单。支持邮箱 + 密码认证以及 Google OAuth。
- 使用 TanStack Router 按最佳实践配置。所有认证逻辑和数据获取在页面加载前于路由中完成。基于路由的动态页面标题切换。
- TanStack Query 与 PocketBase 和 TanStack Router 完全集成。数据在路由渲染前从后端获取并加载。TanStack Query 负责数据获取,确保客户端状态与服务器端数据保持同步。
- 使用新的 React Suspense 边界实现加载状态。
- 使用 React Hook Form 和 Zod 实现带验证和错误消息的动态表单。
- SEO 优化,如 meta description 和社交媒体卡片 meta 标签已添加到根 HTML 页面,sitemap.xml 和 robots.txt 已添加并配置。为 PocketBase 管理后台 "/_" URL 添加排除规则,防止被爬虫索引。

### 开发体验
- 带热重载的 Vite 开发模式可与 PocketBase 无缝协作。无需等待 PocketBase 编译。Vite 和 PocketBase 在不同端口运行时互相代理请求。
- 使用新的 ESlint 9 格式编写的完整 ESlint 配置,包含所有相关的 React、Tailwind 和 Prettier 插件。
- 单命令生产构建。
- 无需额外配置即可在 Docker Compose 中本地运行项目。
- 兼容任何 Node.js 运行时(默认:Bun)。

### 部署
- 编译为单个可执行二进制文件或使用 Docker 容器部署。
- 完全容器化,所有构建步骤都在多阶段 Dockerfile 中完成。输出一个只包含编译后二进制的精简 Alpine 容器。
- 开箱即用的 Docker Compose 部署,包含可用的健康检查端点。
- 可直接部署到 Dokploy、Coolify 等平台。

## 技术栈

- **前端**
  - [TypeScript](https://www.typescriptlang.org/docs/) - 前端语言
  - [React 19](https://react.dev/blog/2024/04/19/react-19) - 前端框架
  - [Vite](https://vite.dev/guide/) - 构建工具
  - [TanStack Router](https://tanstack.com/router/latest/docs/framework/react/overview) - 路由
  - [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview) - 数据获取和状态管理
  - [TanStack Table](https://tanstack.com/table/latest/docs/introduction) - 表格 / 数据网格库
  - [React Hook Form](https://www.react-hook-form.com/api/) - 表单库
  - [shadcn/ui](https://ui.shadcn.com/docs) - 基于 TailwindCSS 和 Radix UI 的 React 组件库
  - [TailwindCSS](https://tailwindcss.com/docs/) - 工具类优先的 CSS 框架
  - [Zod](https://zod.dev/?id=table-of-contents) - TypeScript schema 验证
  - [Date-fns](https://date-fns.org/docs/Getting-Started) - 日期处理库
- **后端**
  - [Go](https://go.dev/doc/) - 后端语言
  - [PocketBase](https://pocketbase.io/docs/) - 后端框架
  - [Pond](https://github.com/alitto/pond) - Go 实现的 worker pool
- **部署**
  - [Docker](https://docs.docker.com/reference/) - 容器化工具
  - [Dokploy](https://dokploy.com) - 开源托管平台

## 快速开始

### 环境要求
- Go 1.26+
- Node.js 25+ 或 Bun 1.3+
- Docker(可选)

### 安装

- 克隆仓库 `git clone https://github.com/s-petr/longhabit`
- 安装依赖 `npm install` 或 `bun install`。
- 为 Pocketbase 管理后台创建新的 superuser(管理员)账号。先编译二进制 `npm run build` 或 `bun run build`,然后运行命令 `./longhabit superuser upsert {{admin email}} {{admin password}}`
- PocketBase 后端启动后,需要设置数据库表。使用 superuser 凭据登录 Pocketbase 管理后台 `http://localhost:8090/_/`,进入 Settings -> Import collections -> Load from JSON file,选择文件 [backend/pb_schema.json](backend/pb_schema.json) 并导入。
- 要使 "Sign in with Google" 按钮生效,需要在 Google Cloud 注册并获取 Google OAuth 2.0 API 凭据(可参考此[指南](https://support.google.com/googleapi/answer/6158849?hl=zh-cn))。获取凭据后,进入 Pocketbase 管理后台 Collections -> Users -> Edit collection -> OAuth2 -> Add provider -> Google,输入 Client ID 和 Client Secret 并保存。
- 根目录下会创建一个 `/db` 文件夹,其中包含数据库文件。Docker Compose 已配置卷以读写同一文件夹的数据。如果 PocketBase 无法从 Docker 容器写入该文件夹,可能需要调整该文件夹的文件权限。

### 本地开发

- 启动开发服务器 `npm run dev` 或 `bun run dev`

### 生产构建

- 构建前端和后端 `npm run build` 或 `bun run build`
- 运行编译后的二进制 `npm run preview` 或 `bun run preview`

### Docker 部署
- 使用 Docker Compose 构建并运行 `npm run compose` 或 `bun run compose`

## 许可证

本项目基于 MIT 许可证授权 - 详情请参阅 [LICENSE.md](LICENSE.md) 文件。
