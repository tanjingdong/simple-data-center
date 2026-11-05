import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { errorToast, successToast } from '@/lib/toast'
import { isSuperuserAuthed } from '@/services/api-frpc'
import {
  deleteUserToken,
  getUsertokenConfig,
  listUserTokens,
  saveUsertokenConfig,
  setUserTokenDisabled,
  type UserTokenListItem
} from '@/services/api-usertoken'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClientResponseError } from 'pocketbase'
import { useState } from 'react'

const PER_PAGE = 20

function errMessage(error: unknown) {
  return error instanceof ClientResponseError
    ? error.response?.error || error.message
    : String(error)
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function statusLabel(item: UserTokenListItem) {
  if (!item.has_token) return '未生成'
  return item.disabled ? '已禁用' : '已生成'
}

export default function UsertokenToolPage() {
  const authed = isSuperuserAuthed()
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  // null 表示未手动修改,展示服务端配置;修改后以本地草稿为准
  const [enabledOverride, setEnabledOverride] = useState<boolean | null>(null)

  const configQuery = useQuery({
    queryKey: ['usertoken-config'],
    queryFn: getUsertokenConfig,
    enabled: authed
  })
  const enabledDraft = enabledOverride ?? configQuery.data?.enabled ?? false

  const listQuery = useQuery({
    queryKey: ['usertoken-list', search, page],
    queryFn: () => listUserTokens(search, page, PER_PAGE),
    enabled: authed
  })

  const saveConfigMutation = useMutation({
    mutationFn: () => saveUsertokenConfig(enabledDraft),
    onSuccess: () => {
      successToast('功能开关已保存')
      queryClient.invalidateQueries({ queryKey: ['usertoken-config'] })
    },
    onError: (e) => errorToast('保存失败', errMessage(e))
  })

  const disableMutation = useMutation({
    mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) =>
      setUserTokenDisabled(id, disabled),
    onSuccess: () => {
      successToast('操作成功')
      queryClient.invalidateQueries({ queryKey: ['usertoken-list'] })
    },
    onError: (e) => errorToast('操作失败', errMessage(e))
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUserToken(id),
    onSuccess: () => {
      successToast('令牌已删除')
      queryClient.invalidateQueries({ queryKey: ['usertoken-list'] })
    },
    onError: (e) => errorToast('删除失败', errMessage(e))
  })

  if (!authed) return null

  const items = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  const handleDelete = (item: UserTokenListItem) => {
    if (
      !confirm(
        `确定删除用户 ${item.email || item.username} 的 API 令牌吗？删除后该用户的令牌立即失效。`
      )
    ) {
      return
    }
    deleteMutation.mutate(item.id)
  }

  return (
    <div className='flex flex-col gap-6'>
      <div>
        <h1 className='text-xl font-bold'>用户key授权</h1>
        <p className='text-muted-foreground text-sm'>
          管理用户 API
          令牌功能的开关，以及查看、禁用或删除用户的令牌。管理员无法生成或查看令牌明文。
        </p>
      </div>

      <div className='max-w-lg rounded-lg border p-6'>
        <h2 className='font-semibold'>功能开关</h2>
        <div className='mt-4 flex items-center gap-3'>
          <Switch
            checked={enabledDraft}
            onCheckedChange={setEnabledOverride}
            disabled={saveConfigMutation.isPending}
          />
          <span className='text-sm'>{enabledDraft ? '已启用' : '已关闭'}</span>
        </div>
        <p className='text-muted-foreground mt-2 text-xs'>
          关闭后用户不能生成新令牌，所有存量令牌校验将全部失败（记录保留）。
        </p>
        <Button
          className='mt-4 w-fit'
          onClick={() => saveConfigMutation.mutate()}
          disabled={saveConfigMutation.isPending}>
          保存开关
        </Button>
      </div>

      <div className='rounded-lg border p-6'>
        <h2 className='font-semibold'>用户令牌</h2>
        <form
          className='mt-4 flex max-w-md gap-2'
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            setSearch(searchInput.trim())
          }}>
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder='按邮箱或用户名搜索'
          />
          <Button type='submit' variant='secondary'>
            搜索
          </Button>
        </form>

        {listQuery.isLoading && (
          <p className='text-muted-foreground mt-4 text-sm'>加载中...</p>
        )}
        {listQuery.error && (
          <p className='text-destructive mt-4 text-sm'>加载用户令牌列表失败</p>
        )}

        {listQuery.data && (
          <>
            <Table className='mt-4'>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>最后使用</TableHead>
                  <TableHead className='text-right'>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='text-muted-foreground text-center'>
                      暂无用户
                    </TableCell>
                  </TableRow>
                )}
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className='flex flex-col'>
                        <span>{item.email || item.username}</span>
                        {item.email && (
                          <span className='text-muted-foreground text-xs'>
                            {item.username}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{statusLabel(item)}</TableCell>
                    <TableCell>{formatDate(item.created_at)}</TableCell>
                    <TableCell>{formatDate(item.last_used_at)}</TableCell>
                    <TableCell className='text-right'>
                      {item.has_token ? (
                        <div className='flex justify-end gap-2'>
                          <Button
                            size='sm'
                            variant='secondary'
                            disabled={disableMutation.isPending}
                            onClick={() =>
                              disableMutation.mutate({
                                id: item.id,
                                disabled: !item.disabled
                              })
                            }>
                            {item.disabled ? '启用' : '禁用'}
                          </Button>
                          <Button
                            size='sm'
                            variant='destructive'
                            disabled={deleteMutation.isPending}
                            onClick={() => handleDelete(item)}>
                            删除
                          </Button>
                        </div>
                      ) : (
                        <span className='text-muted-foreground text-sm'>—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className='mt-4 flex items-center justify-between'>
              <span className='text-muted-foreground text-sm'>
                共 {total} 位用户
              </span>
              <div className='flex items-center gap-2'>
                <Button
                  size='sm'
                  variant='secondary'
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  上一页
                </Button>
                <span className='text-sm'>
                  {page} / {totalPages}
                </span>
                <Button
                  size='sm'
                  variant='secondary'
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}>
                  下一页
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
