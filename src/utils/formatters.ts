import dayjs from 'dayjs';
import nl from 'dayjs/locale/nl';
import Duration from 'dayjs/plugin/duration';
import fileSize from 'filesize';

dayjs.extend(Duration);

export function formatFileSize(size: number) {
  return fileSize(size, { separator: ',' });
}

/**
 * Return a Dutch formatted date, like `30 mei 2020 17:39`
 */
export function formatDateString(date?: string) {
  if (!date) {
    return;
  }
  return dayjs(date).locale(nl).format('D MMM YYYY HH:mm');
}

/**
 * Format the time difference in `m.ss` or `h:mm.ss`.
 *
 * So: `0.00` thru `59.59` if less than an hour (minutes without leading zero, seconds with leading
 * zero), or else `1:00.00` thru `999:59.59` (total hours not limited to a day, and always a leading
 * zero for both minutes and seconds).
 */
export function formatDateDifference(start: string, end?: string) {
  const duration = dayjs.duration(dayjs(end).diff(dayjs(start)));
  // 00..59 with leading zero
  const seconds = `${100 + duration.seconds()}`.substr(1);
  // 0..59 without leading zero
  const minutes = duration.minutes();
  // 0 and up (25 for one day and one hour)
  const hours = Math.trunc(duration.asHours());
  return `${hours ? `${hours}:${`${100 + minutes}`.substr(1)}` : `${minutes}`}.${seconds}`;
}
