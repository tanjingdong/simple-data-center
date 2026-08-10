![Version](https://img.shields.io/badge/version-0.6.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

# tans-PIM

**tans-PIM** 是一个个人社会关系与联系人信息管理(Personal Information Management)应用,用于管理您的社会关系、联系人信息与人脉资源。基于 PocketBase 和 React 构建的生产级全栈项目,单二进制部署,数据自持。

## 主要特性

### 数据模型(5 个集合)

| 集合 | 用途 |
|---|---|
| `persons` | 人员档案:自然属性(性别/生日/民族/生肖/籍贯/出生地)、社会身份(政治面貌/行政职务/技术职称/毕业学校/学历/专业/继续教育)、联系方式、私人档案(兴趣/子女/禁忌/关注)、信任评级(1-5 星) |
| `organizations` | 组织/实体:政府机关、企业、餐厅、学校、医疗机构等,含资源评级、地图链接、备注 |
| `relations` | 人与人关系:描述特定纽带(大学舍友/夫妻等),唯一索引 + 服务端自动规范化 |
| `person_org_links` | 人物-组织关联:法定代表人、股东、常客等 |
| `events` | 事件记录:既记录"约了顿饭",也记录"他被纪委谈话";类型/日期/纪要,支持关联组织 |

### 核心能力

- **id_card 静态加密**:身份证号以 AES-256-GCM 加密入库(Go 钩子实现,密钥 `PIM_ENC_KEY`),API 与管理后台经解密钩子返回明文。
- **圈层检索**:按人脉标签、社会标签、籍贯(老乡圈)、毕业学校(校友圈)、专业(同行)等 LIKE 检索。
- **对外 REST API**:PocketBase 原生接口(CRUD/过滤/分页/expand),供其他程序调用。集合规则公开——请部署在**可信网络边界内**(内网或受控 frps)。
- **数据完整性**:关系唯一索引、评级 1-5 强制校验、级联删除、组织删除自动置空引用。
- **完整认证**:邮箱 + 密码登录,支持 Google OAuth。
- **内置 frpc 反向代理**:工具设置页一键启停,将本服务暴露到公网或子网。
- **通讯录 vCard 导出与二维码**:检索页勾选批量导出 `.vcf` 文件;详情页一键生成 vCard 二维码,手机相机或微信扫码即可添加联系人(微信以「存在合规邮箱」判定名片,无邮箱联系人自动填充占位邮箱 `EMAIL@信息.缺失` 保证可识别)。
- **浅色/深色主题**、响应式布局。

## 技术栈

- **前端**:TypeScript、React 19、Vite、TanStack Router / Query / Table、React Hook Form、Zod、shadcn/ui、TailwindCSS、date-fns
- **后端**:Go、PocketBase 0.39、SQLite
- **部署**:单二进制(Go embed 内嵌前端)、Docker、frp 反向代理

## 内置 frp 服务(反向代理)

内置 frp 客户端(frp v0.70.1,Go 库嵌入,保持单二进制与跨平台编译)。管理员可开启 frpc,通过 tcp 端口映射向 frps 服务器连接反代,将本服务(默认 8090 端口)暴露到公网或子网。

### 使用步骤

1. **导入数据库表**:在 admin 后台(`/_/`)登录后,进入 Settings → Import collections → Load from JSON file,选择 [backend/pb_schema.json](backend/pb_schema.json) 导入。
2. **填写配置**:服务启动后会自动补插 6 个 `frpc_*` 配置项(补插失败时检查第 1 步是否完成)。在 admin 后台 Collections → tools_settings 中填写:

   | option | 说明 |
   |---|---|
   | frpc_server_addr | frps 服务器地址(IP 或域名),必填 |
   | frpc_server_port | frps 服务端口(默认 7000) |
   | frpc_token | frps 认证 token(未设置则留空) |
   | frpc_proxy_name | 代理名称(默认 tans-pim,在 frps 上须唯一) |
   | frpc_local_port | 本地服务端口(默认 8090,与 `--http` 监听端口一致) |
   | frpc_remote_port | frps 上暴露的远程端口(默认 8090) |

3. **启停控制**:打开 `/tools-settings`(应用导航栏「工具设置」)。在 `/_/` 登录管理员后可直接操作——点击「启动」连接 frps,「停止」断开,「重启」用最新配置重新连接。
4. **生效方式**:修改配置后点击「重启」才生效;服务(主程序)重启后 frpc 一律不自动启动,需管理员手动开启。

### 说明与限制

- 当前仅支持 tcp 单代理;启动失败(如地址不可达、token 错误)时,工具页显示「失败」状态与错误信息(初始连接失败约 10 秒后判定,已连接后 frps 断线由 frp 内部自动重连)。
- 工具页与 admin 后台共享登录会话;普通用户登录会顶掉 admin 会话,反之亦然,同一浏览器切换身份需重新登录。
- 若用 `--http` 修改了服务监听端口,请同步修改 `frpc_local_port` 后重启。

## 快速开始

### 环境要求

- Go 1.26+
- Node.js 25+ 或 Bun 1.3+
- Docker(可选)

### 安装

- 克隆仓库(沿用原仓库,当前开发分支 `tans-PIM`):`git clone https://github.com/s-petr/longhabit`
- 安装依赖 `npm install` 或 `bun install`。
- 为 PocketBase 管理后台创建 superuser(管理员)账号:先编译二进制 `npm run build` 或 `bun run build`,然后运行 `./tans-pim superuser upsert {{admin email}} {{admin password}}`。
- 设置加密密钥 `PIM_ENC_KEY`(**必须 32 字符**;未设置时 id_card 将以明文存储,启动时打印警告):
  - `export PIM_ENC_KEY='0123456789abcdef0123456789abcdef'`
- 启动后端,设置数据库表:用 superuser 凭据登录管理后台 `http://localhost:8090/_/`,进入 Settings → Import collections → Load from JSON file,选择文件 [backend/pb_schema.json](backend/pb_schema.json) 导入。
- (可选)启用 "Sign in with Google":在 Google Cloud 获取 OAuth 2.0 凭据后,进入管理后台 Collections → Users → Edit collection → OAuth2 → Add provider → Google,填入 Client ID 与 Client Secret 并保存。
- 根目录下会创建 `/db` 文件夹存放数据库文件。Docker Compose 已配置卷读写同一文件夹。

### 本地开发

- 启动开发服务器 `npm run dev` 或 `bun run dev`

### 生产构建

- 构建前端和后端 `npm run build` 或 `bun run build`(生成二进制 `tans-pim`)
- 运行编译后的二进制 `npm run preview` 或 `bun run preview`(等价于 `./tans-pim serve`)

### Docker 部署

- 构建并运行 `npm run compose` 或 `bun run compose`(通过环境变量 `PIM_ENC_KEY` 传入加密密钥)

## 版本

当前版本 **v0.6.0**,更新日志见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证

本项目基于 MIT 许可证授权 - 详情请参阅 [LICENSE.md](LICENSE.md) 文件。
