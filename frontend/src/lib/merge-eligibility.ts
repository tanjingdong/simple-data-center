// 合并资格判定:与后端 backend/pim_merge.go 的 samePersonName / sameOrganizationName
// 保持同一逻辑,只有判定为同一人/同一组织时才允许打开合并确认对话框。

// 姓名相等:优先比较「姓+名」拼接形态(允许录入边界不同,如 欧阳/锋 ↔ 欧/阳锋),
// 再比较「名 空格 姓」形态。四个姓名部件都必须非空:后端合并校验拒绝缺姓/名的
// 请求(400),前端同口径判定才不会给出一个「点了必定失败」的合并入口。
export function isSamePersonName(
  a: { last_name: string; first_name: string },
  b: { last_name: string; first_name: string }
): boolean {
  if (!a.last_name || !a.first_name || !b.last_name || !b.first_name) {
    return false
  }
  return (
    a.last_name + a.first_name === b.last_name + b.first_name ||
    `${a.first_name} ${a.last_name}` === `${b.first_name} ${b.last_name}`
  )
}

// 组织名称相等:去首尾空白后相等,且 A 侧非空(空名称不构成同名)。
export function isSameOrganizationName(a: string, b: string): boolean {
  const trimmed = a.trim()
  return trimmed !== '' && trimmed === b.trim()
}
