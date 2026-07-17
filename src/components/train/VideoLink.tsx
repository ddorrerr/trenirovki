// Компактная ссылка на видео (Drive / Яндекс.Диск) — всегда обычная ссылка
// в новой вкладке, никаких встраиваний.

import { VideoIcon } from './icons';

export default function VideoLink({
  href,
  label,
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={label ? undefined : 'Видео'}
      className={
        'inline-flex items-center gap-1 rounded-lg px-1.5 py-1.5 -mx-1 -my-1.5 text-sm font-medium text-accent ' +
        (className ?? '')
      }
    >
      {label}
      <VideoIcon size={16} />
    </a>
  );
}
