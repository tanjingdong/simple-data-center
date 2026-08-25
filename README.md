# Simple Data Center

![License](https://img.shields.io/badge/license-MIT-green)

**Simple Data Center** 是一个轻量级 **CRUD 应用基座**:基于 PocketBase 与 React 构建的生产级全栈项目,编译为**单个可执行文件**,可部署到各类平台。您可以在此基座上快速开发自己的 CRUD 业务应用——认证、用户管理、数据后台、反向代理等基础设施已全部就绪,业务开发只需添加数据集合与页面。

## 定位

- **应用基座,而非单一应用**:基座只提供基础设施(认证、文件存储、反向代理、数据后台等),业务开发按「定义集合 → 服务函数 → 页面路由 → 入口」标准模式复制即可。
- **单文件部署**:前端构建产物以 `embed` 方式打包进 Go 二进制,一个文件包含全部前后端,复制到任意平台即可运行。
- **数据自主**:使用 PocketBase 作为后端框架与数据层,数据存放在本地 SQLite 数据库,完全由您掌控。

## 主要特性

### 后端架构
- 运行最新版 PocketBase (v0.39)。
- 单二进制构建:使用 Go 的 `embed` 包将 React 前端嵌入编译后的二进制中。
- PocketBase 以 Go 包形式安装并作为框架使用,已启用大量扩展特性:
  - 自定义 hooks 与中间件
  - 路由绑定
  - 数据库操作
  - HTML 邮件模板
  - 自定义日志配置
- 内置 frp 客户端(frp v0.70.1 以 Go 库方式嵌入,保持单二进制与跨平台编译),可通过 tcp 端口映射将本服务暴露到公网或子网。
- 惯用的 Go 代码组织,职责分离清晰。

### 前端实现
- 使用 TypeScript 与 Vite 构建的现代 React 配置。
- 基于 React 19 构建,支持 React Compiler。
- 完整配置 TailwindCSS 与 ShadCN UI,带自定义主题。
- 响应式设计,支持浅色与深色模式。
- 完整认证流程:邮箱 + 密码认证、Google OAuth、密码重置、邮箱验证。
- TanStack Router:路由内完成认证与数据预取,动态页面标题。
- TanStack Query 与 PocketBase、Router 全集成,数据在路由渲染前获取。
- React Hook Form + Zod 动态表单验证。
- SEO 基础配置(meta 描述、sitemap、robots)。

### 内置功能
- **数据大厅**(`/center`):登录后落地页,集中提供各业务功能入口。
- **用户设置**(`/user-setting`):头像、昵称、用户名、邮箱(邮件确认流程)、邮箱可见开关、修改密码、退出登录。
- **管理工具**(`/admin`):管理员区域,目前含 **frpc 反向代理工具**(启动/停止/重启、连接配置、状态查看)与 **filestore 文件存储工具**(Alist 连接配置、连通性自检、孤儿文件对账)。
- **数据管理**(`/_/`):PocketBase 管理后台,集合管理、数据编辑、导入导出。

### 开发体验
- 带热重载的 Vite 开发模式与 PocketBase 无缝协作。
- 完整 ESlint 9 配置(React、Tailwind、Prettier 插件)。
- 单命令生产构建。
- Docker Compose 本地运行。

### 部署
- 编译为单个可执行二进制,或使用 Docker 容器部署。
- 多阶段 Dockerfile 输出精简 Alpine 容器。
- 可直接部署到 Dokploy、Coolify、自有服务器等平台。

## 技术栈

- **前端**:TypeScript、React 19、Vite、TanStack Router、TanStack Query、TanStack Table、React Hook Form、shadcn/ui、TailwindCSS、Zod、Date-fns
- **后端**:Go、PocketBase
- **部署**:Docker、Dokploy

## 在此基座上开发业务(快速上手)

基座已完成全部基础设施,开发一个新 CRUD 业务只需四步(以「图书管理」为例):

1. **定义数据集合**:在数据管理后台(`/_/`)创建集合,或编辑 `backend/pb_schema.json` 后导入(Settings → Import collections)。
2. **添加服务函数**:在 `frontend/src/services/` 新建 `api-books.ts`,封装集合的增删改查(参照 `api-filestore.ts`)。
3. **创建页面**:在 `frontend/src/pages/` 新建页面组件,在 `router.tsx` 注册路由(参照 `pages/files/files-page.tsx` 与 `filesRoute`)。
4. **加入入口**:在数据大厅 `center.tsx` 添加功能入口链接。

无需改动任何后端 Go 代码——集合、权限规则、数据校验均由 PocketBase 提供。

## 快速开始

### 环境要求
- Go 1.26+
- Node.js 25+ 或 Bun 1.3+
- Docker(可选)

### 安装

1. 克隆仓库 `git clone https://github.com/s-petr/longhabit`
2. 安装依赖 `npm install` 或 `bun install`。
3. 编译二进制并创建管理员账号(先 `npm run build`,再运行 `./simple-data-center superuser upsert {{admin email}} {{admin password}}`)。
4. 启动后,使用管理员凭据登录 PocketBase 管理后台 `http://localhost:8090/_/`,进入 Settings → Import collections → Load from JSON file,选择 [backend/pb_schema.json](backend/pb_schema.json) 导入(users/settings/tasks/tools_settings 等集合)。
5. 可选:启用 Google OAuth(在 Collections → Users → Edit collection → OAuth2 中配置)。
6. 数据库文件位于 `/db` 目录。

### 本地开发

- 启动开发服务器 `npm run dev`(Vite 热重载 + PocketBase 同起)

### 生产构建

- 构建前端和后端 `npm run build`
- 运行编译后的二进制 `npm run preview`(即 `./simple-data-center serve`)

### Docker 部署

- 使用 Docker Compose 构建并运行 `npm run compose`

## 内置 frp 服务(反向代理)

管理员可在管理工具(`/admin`)中开启 frpc 功能,通过 tcp 端口映射向 frps 服务器连接反代,将本服务(默认 8090 端口)暴露到公网或子网。

### 使用步骤

1. **导入数据库表**:在数据管理后台(`/_/`)进入 Settings → Import collections → Load from JSON file,选择 [backend/pb_schema.json](backend/pb_schema.json) 导入(`tools_settings` 表)。
2. **填写配置**:服务启动后会自动补插 `frpc_*` 配置项(补插失败时检查第 1 步是否完成)。在数据管理后台 Collections → tools_settings 中填写:

   | option | 说明 |
   |---|---|
   | frpc_server_addr | frps 服务器地址(IP 或域名),必填 |
   | frpc_server_port | frps 服务端口(默认 7000) |
   | frpc_token | frps 认证 token(未设置则留空) |
   | frpc_proxy_name | 代理名称(默认 simple-data-center,在 frps 上须唯一) |
   | frpc_local_port | 本地服务端口(默认 8090,与 `--http` 监听端口一致) |
   | frpc_remote_port | frps 上暴露的远程端口(默认 8090) |

3. **启停控制与配置**:打开 `/admin`(导航栏「管理工具」)。未登录时显示管理员登录表单,登录后即可操作——点击「启动」连接 frps,「停止」断开,「重启」用最新配置重新连接;「连接配置」表单可修改 frps 地址、端口、token 等,保存后自动重启生效。右上角「数据管理」可打开 PocketBase 管理后台(`/_`)。
4. **生效方式**:修改配置后点击「重启」才生效;服务(主程序)重启后 frpc 一律不自动启动,需管理员手动开启。

### 说明与限制

- 当前仅支持 tcp 单代理;启动失败(如地址不可达、token 错误)时,工具页显示「失败」状态与错误信息。
- 工具页与数据管理后台共享登录会话。
- 若用 `--http` 修改了服务监听端口,请同步修改 `frpc_local_port` 后重启。

## 文件存储管理(接 Alist)

本项目内置一个通用文件存储服务,接入 [Alist](https://github.com/alist-org/alist)(v3.53+)作为外部存储。本应用不写存储驱动,只做**编排 + 鉴权 + 元数据登记**;Alist 管理 token 绝不暴露给前端。

### 角色分工

- **管理员(superuser)**:在管理工具(`/admin`)配置 Alist 连接、全局大小/MIME 限制、下载通道模式,可做连通性自检与孤儿文件对账。
- **普通用户**:上传自己的文件,逐文件设定可见性(`private` / `public`),仅 owner 可改/删自己的文件。
- **匿名用户**:仅可下载 `public` 文件。

### 核心能力

- **上传**:浏览器 → 本应用后端(鉴权 + 大小/MIME 校验)→ 流式转发 → Alist,文件按 `{根路径}/{年}/{月}/{用户ID}/{uuid}.{ext}` 归档。
- **下载双通道**(管理员全局开关 `filestore_download_mode`):
  - `direct`(默认):后端签发 Alist sign 直链 → 302 重定向,浏览器直连 Alist 取字节。
  - `proxy`:后端从 Alist 流式拉取 → 字节透传给客户端(不暴露 Alist 地址)。
- **内联预览**(V0.7.1):前端 `getPreviewUrl(id)` 在下载 URL 上加 `?inline=1`,`proxy` 模式下后端返回 `Content-Disposition: inline`,可直接用于 `<img>` / `<iframe>` 标签内联显示;`direct` 模式参数被忽略(由 Alist 决定)。
- **孤儿文件对账**:对比本应用 DB 记录与 Alist 实际文件,列出差异(仅报告不自动删除)。

### 配置项

服务启动后会自动补插 `filestore_*` 配置项(补插失败时检查是否已在数据管理后台导入 `filestore_files` 与 `tools_settings` 表)。在数据管理后台 Collections → tools_settings 中填写:

| option | 说明 |
|---|---|
| filestore_alist_url | Alist 服务地址(如 http://192.168.1.100:5244),必填 |
| filestore_alist_token | Alist 管理 token(用于签发 sign 与 API 调用),必填 |
| filestore_max_size | 单文件大小上限(字节,默认 10MB) |
| filestore_allowed_mimes | 允许的 MIME 类型(逗号分隔,空=允许所有) |
| filestore_download_mode | 下载通道:direct(直连 Alist)/ proxy(经后端代理) |
| filestore_storage_path | Alist 上的存储根路径(默认 /simple-data-center) |

### 使用步骤

1. **导入数据库表**:在数据管理后台(`/_/`)Settings → Import collections → Load from JSON file,选择 [backend/pb_schema.json](backend/pb_schema.json) 导入(`filestore_files` 与 `tools_settings` 表)。
2. **填写配置**:在管理工具(`/admin`)的「文件存储」页填写 Alist 地址、token、大小/MIME 限制、下载模式,保存后点「连通性自检」验证 Alist 可达。
3. **上传/下载/预览**:普通用户在「我的文件」(`/files`)上传文件;下载用 `getDownloadUrl(id)`,内联预览用 `getPreviewUrl(id)`。
4. **孤儿对账**:管理员在文件存储工具页点「孤儿对账」,检查 Alist 上是否有 DB 无记录的残留文件。

### 说明与限制

- `filestore_files` 与 Alist 实际文件是两个事实源,上传/删除一律走本应用后端(把 Alist 当「只由本应用写的存储」),禁止手改 Alist 后台文件以免产生孤儿。
- `private` 文件用 `<img>` 等原生标签无法内联预览(标签不带鉴权头),会回退占位符;`public` 文件可直接内联。若需 private 文件也内联显示,后续可引入带 TTL 的短期预览直链(复用现有 sign 思路)。
- 业务模块通过 REST API 调用文件存储接口,用 `filestore_files` 记录 ID 关联文件,无需改动 filestore 本身。

## 许可证

本项目基于 MIT 许可证授权 - 详情请参阅 [LICENSE.md](LICENSE.md) 文件。
