// 转义 PocketBase filter 字符串字面量中的特殊字符(单引号与反斜杠),
// 避免用户输入拼坏过滤器。
// 这是前端唯一的实现;api-persons 从这里导入,并保留同名再导出以兼容既有导入路径。
export function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
