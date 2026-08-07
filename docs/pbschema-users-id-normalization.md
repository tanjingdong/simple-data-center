# 任务:pbschema 中 users 字段 ID 规范化(0.39.4 新模板)

> **状态:已于 2026-08-07 在本分支完成**——users.name/avatar 字段 id 已规范化为 text1579384326 / file376926767,全新 0.39.4 实例标准导入零冲突验证通过(替代了此前「集合定义手术」方案,手术版数据库已归档为 db.bak-surgery-20260807)。

## 背景与根因

`backend/pb_schema.json` 是从旧项目数据库(v0.5.0)导出的,其中 `users` 集合的字段 id 来自**早期 PocketBase 版本的模板**(旧风格:`users_name`、`users_avatar`,且带 `username` 字段)。而在全新机器上首次运行(如 `superuser upsert`)时,PocketBase 0.39.4 会按**新模板**创建 `users`(字段 id 为 `text1579384326`、`file376926767`,且默认无 `username`)。

由于 PocketBase 升级保留旧 id、全新安装使用新 id,同一份 schema 导入全新库时,admin 后台会提示:

> "Some of the imported collections share the same name and/or fields but are imported with different IDs. You can replace them in the import if you want to:"

已定位:触发提示的只有 `users` 集合的 **2 个字段**——`name` 与 `avatar`(同名不同 id)。`username`、`authWithPasswordAvailable` 因全新库无此字段,属于纯新增,不触发。

## 改动内容(仅改 `backend/pb_schema.json` 中 users 集合的 2 个字段 id)

| 字段 | 现状(旧模板 id) | 改为(0.39.4 新模板 id) |
|---|---|---|
| `name` | `users_name` | `text1579384326` |
| `avatar` | `users_avatar` | `file376926767` |

**明确保留不动**:

- `username` 字段(id `text4166911607`)——项目自定义,导入时作为新增字段加入,保证"邮箱或用户名"登录(`passwordAuth.identityFields: ["email","username"]`)行为不变;
- `authWithPasswordAvailable` 字段(id `xl20kdvw`)——后端 auth.go 钩子依赖;
- users 的 oauth2 配置、authAlert/各邮件模板、集合级 options 全部不动;
- 5 个业务集合(persons/organizations/relations/person_org_links/events)与 tools_settings 不涉及此问题(全新库中为新建,使用声明的 id,永不冲突)。

## 效果与影响

- **全新安装**:导入零提示、零冲突;users 按 id 完全匹配 + username/authWithPasswordAvailable 作为新增字段干净加入,应用行为与现在一致。
- **旧库**(如仓库内开发用 `db/` 数据)若之后导入此文件会**反向**提示一次(旧 id vs 新 id)——属一次性开发数据,可点「Replace with original IDs」或直接忽略;部署路径以全新库为准。

## 验证方法(改完后)

1. `python3 -c "import json; json.load(open('backend/pb_schema.json'))"` — JSON 有效;
2. 本地复现对比(在临时目录建全新库):

```bash
rm -rf /tmp/fresh-db && ./tans-pim superuser upsert t@t.local Test123456 --dir=/tmp/fresh-db
python3 - <<'EOF'
import json, sqlite3
conn = sqlite3.connect('/tmp/fresh-db/data.db')
fresh = {n: json.loads(f) for n, f in conn.execute("select name, fields from _collections")}
ours = json.load(open('backend/pb_schema.json'))
ou = next(c for c in ours if c['name'] == 'users')
fu = {f['id']: f.get('name') for f in fresh['users']}
for f in ou['fields']:
    print(f['id'], f.get('name'), '→ 新库:', fu.get(f['id'], '(无,新增)'))
EOF
```

预期:所有字段 id 与全新库一致,仅 `username`、`authWithPasswordAvailable` 显示"(无,新增)"——即不再有同名不同 id 的情况;

3. (可选)实机导入确认 admin 后台不再出现「Replace with original IDs」提示。

## 补充

- 该改动仅涉及 schema 文件两个字段 id 的字符串替换,不影响任何 Go 代码、数据库已有数据(PocketBase 按 id 匹配字段)。
- 若另一分支的 schema 已做过其他改动,改前先 `git diff` 确认 users 部分与上述基线一致,避免覆盖其他调整。
