# Changelog

## V0.7.5

### **用户 API 令牌(用户key授权)**
- 用户设置页新增「API 令牌」卡片：用户可生成/重置/删除自己的 API 令牌；令牌明文仅在生成时展示一次，数据库只保存 SHA-256 哈希，每用户最多 1 个。
- 管理工具新增「用户key授权」页：功能总开关、按邮箱/用户名搜索用户令牌状态、禁用/启用、删除 (安全兜底)；管理员不能生成或查看令牌明文。
- 新增后端 `backend/usertoken` 包与 `usertoken.RequireAuth` 校验中间件(本期未挂载到任何现有路由)：`Authorization: Bearer <token>` 校验通过后请求以该用户身份执行；`last_used_at` 按 60 秒节流更新。
- users 集合新增 4 个 hidden 字段(`api_token_hash` / `api_token_created_at` / `api_token_last_used_at` / `api_token_disabled`)与部分唯一索引；非 superuser 无法通过 PB API 读写，另加请求 hook 拦截 superuser 的直接改写。
- 升级提示：已有部署需在数据管理后台重新导入 `backend/pb_schema.json` 的 users 集合(或手工添加 4 个字段与索引)；`usertoken_enabled` 配置项由服务启动时自动补插。

### **开发工具**
- 新增 `dev_tools/start.sh`：检查二进制与既有进程后后台启动服务，日志写入 `server.log`；已有本服务进程时拒绝启动并提示先停止，避免端口冲突。
- 新增 `dev_tools/stop.sh`：终止本机所有本项目服务进程(按进程名与命令行精确匹配，先 SIGTERM、3 秒未退再 SIGKILL)，支持 `--dry-run` 仅列出待终止 PID。
- `dev_tools/restart.sh` 改为复用 `start.sh` 与 `stop.sh`，消除重复的启动/停止逻辑。

## V0.7.4

- 新增公开文档 `READEM_developer.html`，作为项目二次开发说明书（由 AI 生成，尚未校对）。

## V0.7.3
### **文件存储管理工具优化**
- 「我的文件」列表每个文件行新增「复制浏览链接」按钮：点击将文件的 API 浏览地址(绝对地址 + `?inline=1`,proxy 模式下图片/PDF 可在浏览器内联显示)复制到剪贴板并 toast 提示。公开与私有文件均可复制(私有链接仅登录且有权限者访问,未授权打开显示占位图)。
- 大文件下载保护:「我的文件」下载按钮增加前置确认——文件大于 10MB 时先弹窗提示「文件将完整加载到浏览器内存,可能占用较多内存」,确认后才执行下载,取消则不下载;小文件下载不受影响。
- 前端新增工具函数:`getAbsoluteFileUrl(id, inline)`(带协议域名拼接)、`copyText(text)`(剪贴板助手,http 局域网等非安全上下文自动降级为 `execCommand` 复制)、常量 `BIG_FILE_SIZE`(10MB 下载确认阈值)。

### **链接管理工具(帮助中心入口)**
- 新增管理工具「链接管理」(导航栏「管理工具」→ 链接管理):配置项 `links_help_center_url`(帮助中心目标地址,绝对或 `/` 开头的根相对路径)与 `links_error_html`(未配置/非法时展示的报错页 HTML,内置默认文案,可修改)。
- 导航栏新增固定入口「帮助中心」(管理工具与账号之间,匿名可见,新标签页):目标固定为 `/links/help-center`,由后端网关裁决——配置合法则 302 跳转(`Cache-Control: no-store` 防缓存),未配置/非法则展示报错页;前端零判断逻辑、无公开配置 API,配置内容始终不可被非管理员读取。
- URL 校验仅收受绝对地址(危险协议 `javascript:`/`data:`/`vbscript:`/`file:` 黑名单除外)与 `/` 开头的根相对路径;裸相对地址(如 `help.html`)解析基准未定义、一律拒绝并提示改用 `/` 开头或完整绝对地址——前后端同规则中文报错,管理工具页即填即验,保存后端二次校验。
- 配置保存采用部分更新语义(仅提交单项时不清空另一项);后端新增 `backend/links` 包 11 个单测:URL/报错 HTML 校验矩阵、网关决策(合法→302 / 未配置·非法→报错页)、部分更新、配置回读。

## V0.7.2

- 删除示例业务「任务模块」(task):前端 `pages/tasks`、`components/tasks`、`api-tasks`、`task-schema`、`task-status`、`date-convert`、`use-tasks` 及相关路由;后端 `notifier` 邮件提醒包(仅服务 task)、`tasks.page.gohtml` 模板、`pb_schema` 的 tasks 集合;`main`/`mailer` 去 `startNotifier` 与 appConfig mailer 字段。
- 基座通用邮件(邮箱验证 / 密码重置 / 新设备登录)与用户设置、文件存储、frpc 等基础设施保留。
- README 删除 task 示例描述,快速上手改参照 filestore;移除 Pond 与「带 cron 的定时任务」描述(随 notifier 删除不再使用)。

## V0.7.1

- filestore 下载支持 `?inline=1`:`proxy` 模式下返回 `Content-Disposition: inline`,供 `<img>`/`<iframe>` 内联预览;`direct` 模式忽略参数。
- 新增前端 `getPreviewUrl(id)`;后端 `resolveDisposition` 纯函数 + `TestResolveDisposition` 单测。
- 修复 `getDownloadUrl` 因 `pb.baseUrl` 默认 `"/"` 拼成 `//api/...`(protocol-relative,浏览器把 `api` 当主机名)的 bug。
- `server.log` 移出 git 跟踪(已加入 `.gitignore`,此前被误跟踪)。
- 补充 README「文件存储管理(接 Alist)」特性说明。

## V0.7.0

- 新增业务模块注册管理，优化大厅业务入口页面，并把验证逻辑抽象为公共函数供所有业务模块共用。
- 新增 Alist/Openlist 文件存储支持工具（系统管理级工具）。