# 版本更新日志

本项目版本号遵循语义化版本(SemVer)。版本记录自 v0.5.0 起,更早版本见 git 历史。

## [0.6.0] - 2026-08-07

### 项目更名

- 项目更名为 **tans-PIM**(个人社会关系与联系人信息管理)。
- 编译二进制名由 `longhabit` 改为 `tans-pim`(构建脚本、Dockerfile、Docker Compose、.gitignore 同步更新)。
- frpc 默认代理名由 `longhabit` 改为 `tans-pim`(已入库的存量配置不受影响,如需沿用旧名可在工具设置表中手动改回)。
- 前端品牌文案(页面标题、导航 Logo、隐私政策、邮件模板落款)统一为 tans-PIM。

### 新增(PIM 改造 · 子项目 1:数据层与后端)

- 5 个业务集合(经 `backend/pb_schema.json` 导入):
  - `persons` 人员(自然属性、社会身份、联系方式、私人档案、信任评级、圈层检索字段)
  - `organizations` 组织/实体(类型、资源评级、地图链接、备注)
  - `relations` 人与人关系(单向唯一索引,服务端自动规范化 person_a < person_b)
  - `person_org_links` 人物-组织关联(任职/法定代表人/常客等)
  - `events` 事件记录(人物必填、组织可空、日期倒序索引、开放类型文本)
- `id_card` 身份证号 **AES-256-GCM 静态加密**(Go 钩子实现,密文 `enc:` 前缀幂等,密钥取环境变量 `PIM_ENC_KEY`,未设置时启动告警且不加密)。
- 对外 REST API:PocketBase 原生接口(CRUD/过滤/分页/expand),集合规则公开,供其他程序调用。
- 圈层检索字段:人脉标签、社会标签、籍贯、毕业学校、专业(逗号分隔文本 + LIKE 检索)。
- 组织删除时自动置空引用它的 `events.org_id` 与 `persons.current_org_id`(替代 SQL ON DELETE SET NULL)。
- `trust_level` / `importance_level` 强制 1-5 校验(0 与空值均拒绝,写入钩子实现)。

### 移除(习惯追踪功能)

- 删除 `tasks`、`settings` 集合及习惯任务、统计、提醒相关页面与代码(前端页面清理随子项目 2 完成)。
- 删除邮件提醒服务:notifier 包、mailer、定时任务(cron)。
- 删除邮件/任务 HTML 模板。
- `go mod tidy` 清理死依赖(pond 等)。

### 修复

- CLI 命令(含 `serve` 优雅退出)成功时错误返回退出码 1 的问题(原 `log.Fatal(app.pb.Start())` 改为标准错误处理)。
- `decryptIdCard` 对短密文(不足 GCM nonce)可能 panic 的问题,增加长度防护。

### 已知事项

- 前端 `tasks`/`settings` 相关页面与主题设置的界面迁移(主题偏好改存浏览器 localStorage)将在子项目 2(前端界面)完成;当前版本登录后进入工作台前的旧页面暂不可用。
- 数据模型、界面结构、对话区等完整规划见设计文档 `docs/superpowers/specs/2026-08-07-pim-transformation-design.md`。

## [0.5.0] - 2026-08-05

- 内置 frpc 反向代理客户端(Go 库嵌入)与通用工具设置表 `tools_settings`。
- 管理员可在「工具设置」页启停 frpc,将本服务经 frps 暴露到公网或子网。

## 更早版本

- v0.5.0 之前的版本未单独记录,主要内容(来自 git 历史):简体中文本地化、PocketBase 0.37 → 0.39 升级、Vite 8 与依赖更新。
