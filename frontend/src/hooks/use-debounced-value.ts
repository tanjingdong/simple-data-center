import { useEffect, useState } from 'react'

// 值去抖:value 稳定 delay 毫秒后才返回新值,用于输入类检索。
export function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
