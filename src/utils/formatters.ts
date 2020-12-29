import dayjs from 'dayjs';
import nl from 'dayjs/locale/nl';
import fileSize from 'filesize';

export function formatFileSize(size: number) {
  return fileSize(size, { separator: ',' });
}

export function formatDateString(date: string) {
  return dayjs(date).locale(nl).format('D MMM YYYY HH:mm');
}
