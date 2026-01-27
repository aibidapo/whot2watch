import { HTMLAttributes, useState } from 'react';

type ThumbProps = HTMLAttributes<HTMLDivElement> & {
  posterUrl?: string;
  backdropUrl?: string;
  voteAverage?: number;
  alt?: string;
};

export function Thumb({
  posterUrl,
  backdropUrl,
  voteAverage,
  alt,
  className = '',
  ...rest
}: ThumbProps) {
  const [imgError, setImgError] = useState(false);

  // Prefer poster; if it errors, fall back to backdrop or skeleton
  if (posterUrl && !imgError) {
    return (
      <div className={`group relative overflow-hidden ${className}`} {...rest}>
        <img
          src={posterUrl}
          alt={alt || ''}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={() => setImgError(true)}
        />
        {typeof voteAverage === 'number' ? (
          <span className="thumb-badge">
            <span className="star">★</span>
            {voteAverage.toFixed(1)}
          </span>
        ) : null}
      </div>
    );
  }

  // Backdrop second, dimmed with overlay
  if (backdropUrl) {
    return (
      <div
        className={`relative thumb-backdrop ${className}`}
        style={{ backgroundImage: `url(${backdropUrl})` }}
        role="img"
        aria-label={alt || 'Title backdrop'}
        {...rest}
      >
        <div className="thumb-overlay" />
        {typeof voteAverage === 'number' ? (
          <span className="thumb-badge">
            <span className="star">★</span>
            {voteAverage.toFixed(1)}
          </span>
        ) : null}
      </div>
    );
  }

  // Skeleton fallback
  return <div className={`skeleton ${className}`} {...rest} />;
}
