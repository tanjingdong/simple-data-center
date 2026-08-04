import { Task, TaskHistoryDate } from '@/schemas/task-schema'
import { Row } from '@tanstack/react-table'
import {
  differenceInCalendarDays,
  format,
  formatDistanceStrict
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { getNextDueDate, stringToDate } from './date-convert'

export function getTaskStatusLabels(
  repeatGoalEnabled: boolean,
  daysRepeat: number,
  history: TaskHistoryDate[]
) {
  const lastDate = history[0] ? stringToDate(history[0]) : null
  const nextDate = getNextDueDate(history, daysRepeat)
  const daysSince = lastDate
    ? differenceInCalendarDays(new Date(), lastDate)
    : 0
  const dueInDays = differenceInCalendarDays(nextDate, new Date())
  const taskIsLate = repeatGoalEnabled ? dueInDays < 0 : false

  let dateText, daysText

  if (repeatGoalEnabled && daysRepeat > 0) {
    dateText = `下次 ${format(nextDate, 'yyyy年M月d日')}`

    const numDaysAbs = Math.abs(dueInDays)

    let numDaysText
    if (numDaysAbs === 1) {
      numDaysText = '1 天'
    } else if (numDaysAbs <= 45) {
      numDaysText = `${numDaysAbs} 天`
    } else {
      numDaysText = formatDistanceStrict(nextDate, new Date(), {
        locale: zhCN
      })
    }

    if (dueInDays === 0) {
      daysText = '今天到期'
    } else if (dueInDays > 0) {
      daysText = `${numDaysText}后到期`
    } else {
      daysText = `逾期 ${numDaysText}`
    }
  } else {
    dateText = lastDate
      ? `上次 ${format(lastDate, 'yyyy年M月d日')}`
      : '从未完成'

    if (!lastDate) {
      daysText = '—'
    } else if (daysSince === 0) {
      daysText = '今天完成'
    } else if (daysSince === 1) {
      daysText = '1 天前完成'
    } else if (daysSince <= 45) {
      daysText = `${daysSince} 天前完成`
    } else {
      daysText = `${formatDistanceStrict(new Date(), lastDate, {
        locale: zhCN
      })} 前完成`
    }
  }

  return { dateText, daysText, taskIsLate }
}

export function sortTaskStatusColumn(rowA: Row<Task>, rowB: Row<Task>) {
  const today = new Date()

  if (rowA.original.repeatGoalEnabled !== rowB.original.repeatGoalEnabled) {
    return rowA.original.repeatGoalEnabled ? -1 : 1
  }

  if (rowA.original.repeatGoalEnabled) {
    const dateA = getNextDueDate(
      rowA.original.history,
      Number(rowA.original.daysRepeat)
    )
    const dateB = getNextDueDate(
      rowB.original.history,
      Number(rowB.original.daysRepeat)
    )
    return dateA.getTime() - dateB.getTime()
  }

  const lastDateA = rowA.original.history[0]
    ? stringToDate(rowA.original.history[0])
    : null
  const lastDateB = rowB.original.history[0]
    ? stringToDate(rowB.original.history[0])
    : null

  if (!lastDateA && !lastDateB) return 0
  if (!lastDateA) return 1
  if (!lastDateB) return -1

  return (
    differenceInCalendarDays(today, lastDateB) -
    differenceInCalendarDays(today, lastDateA)
  )
}
