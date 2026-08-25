# Changelog

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