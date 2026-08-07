import { cn } from '@/lib/shadcn'
import { StarIcon } from 'lucide-react'

// 1-5 星评级展示(0 显示「未评级」)
export function TrustStars({
  value,
  size = 'size-4'
}: {
  value: number
  size?: string
}) {
  if (value < 1)
    return <span className='text-muted-foreground text-xs'>未评级</span>
  return (
    <span className='inline-flex items-center gap-0.5'>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          className={cn(
            size,
            star <= value
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-muted-foreground/40'
          )}
        />
      ))}
    </span>
  )
}
