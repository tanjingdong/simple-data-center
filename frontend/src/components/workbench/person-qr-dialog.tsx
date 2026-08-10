import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { VCARD_QR_MAX_BYTES, buildVCardBytes } from '@/lib/vcard'
import type { PersonWithOrg } from '@/services/api-persons'
import { QRCodeSVG } from 'qrcode.react'
import { useMemo } from 'react'

// 通讯录二维码弹窗:复用 buildVCard 生成完整 vCard,UTF-8 编码后由 QRCodeSVG
// 渲染(纠错级别 L 容量最大);超出 2953 字节上限时仅提示不渲染二维码;
// 二维码黑块白底固定不反色,白卡片包裹保证深浅主题均可扫描
export default function PersonQrDialog({
  person,
  onClose
}: {
  person: PersonWithOrg
  onClose: () => void
}) {
  const bytes = useMemo(() => buildVCardBytes(person), [person])
  const overLimit = bytes.length > VCARD_QR_MAX_BYTES

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>通讯录二维码</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col items-center gap-3 py-2'>
          <div className='text-lg font-semibold'>
            {person.last_name}
            {person.first_name}
          </div>
          {overLimit ? (
            <p className='text-sm text-muted-foreground'>
              联系人信息过多,超出二维码容量上限
            </p>
          ) : (
            <div className='rounded-xl bg-white p-4'>
              <QRCodeSVG
                // QRCodeSVG 的 value 只接受字符串;qrcode.react 内部按
                // UTF-8 编码,与 buildVCardBytes 的字节完全一致,故解码回原串
                value={new TextDecoder().decode(bytes)}
                level='L'
                size={220}
                bgColor='#ffffff'
                fgColor='#000000'
              />
            </div>
          )}
          <p className='text-center text-xs text-muted-foreground'>
            用手机相机或微信扫码即可添加联系人
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
