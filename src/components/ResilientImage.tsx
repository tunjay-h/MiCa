import React, { useMemo, useState } from 'react';

interface ResilientImageProps {
  src: string;
  alt?: string;
  className?: string;
  captionClassName?: string;
  showCaption?: boolean;
}

export function ResilientImage({ src, alt, className, captionClassName, showCaption = true }: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  const fallbackMessage = useMemo(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'Image unavailable while offline';
    }
    return 'Image failed to load';
  }, []);

  if (failed) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
        <div className="flex items-center gap-2 text-amber-200">
          <span aria-hidden>⚠️</span>
          <span>{fallbackMessage}</span>
        </div>
        {showCaption ? (
          <span className={captionClassName ?? 'break-all text-slate-400'}>{src}</span>
        ) : null}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? ''}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
