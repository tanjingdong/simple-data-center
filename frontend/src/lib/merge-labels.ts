import type { MergeKind } from '@/services/api-pim-merge'

// 合并对话框的创建时间展示:后端返回 RFC3339 字符串,前端按中文界面格式化。
// 空值或非法值返回空串,避免界面上出现 Invalid Date。
export function formatMergeCreated(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN')
}

// 合并预览字段的中文标签:key 与后端字段白名单一一对应,顺序与编辑表单分组一致。
// 对话框按后端返回的 fields 顺序渲染,只按 key 查标签,不依赖本表的顺序。
export const mergeLabels: Record<MergeKind, { key: string; label: string }[]> =
  {
    persons: [
      { key: 'last_name', label: '姓' },
      { key: 'first_name', label: '名' },
      { key: 'nickname', label: '昵称' },
      { key: 'gender', label: '性别' },
      { key: 'birthday', label: '生日' },
      { key: 'id_card', label: '身份证号' },
      { key: 'ethnicity', label: '民族' },
      { key: 'blood_type', label: '血型' },
      { key: 'zodiac', label: '生肖' },
      { key: 'native_place', label: '籍贯' },
      { key: 'birth_place', label: '出生地' },
      { key: 'political_status', label: '政治面貌' },
      { key: 'current_org_id', label: '当前单位' },
      { key: 'admin_position', label: '行政职务' },
      { key: 'tech_title', label: '技术职称' },
      { key: 'legal_info', label: '法人信息' },
      { key: 'mobile', label: '手机' },
      { key: 'office_phone', label: '座机' },
      { key: 'email', label: '邮箱' },
      { key: 'office_address', label: '办公地址' },
      { key: 'home_address', label: '住宅地址' },
      { key: 'person_tags', label: '人脉标签' },
      { key: 'social_tags', label: '社会标签' },
      { key: 'trust_level', label: '信任评级' },
      { key: 'interests', label: '兴趣' },
      { key: 'children_info', label: '子女' },
      { key: 'taboo', label: '禁忌' },
      { key: 'concern', label: '关注' },
      { key: 'graduate_school', label: '毕业学校' },
      { key: 'degree', label: '学历' },
      { key: 'major', label: '专业' },
      { key: 'continuing_edu', label: '继续教育' }
    ],
    organizations: [
      { key: 'name', label: '名称' },
      { key: 'type', label: '类型' },
      { key: 'importance_level', label: '资源评级' },
      { key: 'phone', label: '电话' },
      { key: 'email', label: '邮箱' },
      { key: 'map', label: '地图链接' },
      { key: 'address', label: '地址' },
      { key: 'notes', label: '备注' }
    ]
  }
