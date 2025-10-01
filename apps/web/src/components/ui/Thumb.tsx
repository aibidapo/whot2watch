import { HTMLAttributes, useState } from 'react';

type ThumbProps = HTMLAttributes<HTMLDivElement> & {
  posterUrl?: string;
  backdropUrl?: string;
  voteAverage?: number;
};

export function Thumb({
  posterUrl,
  backdropUrl,
  voteAverage,
  className = '',
  ...rest
}: ThumbProps) {
  const [imgError, setImgError] = useState(false);

  // Prefer poster; if it errors, fall back to backdrop or skeleton
  if (posterUrl && !imgError) {
    return (
      <div className={`relative ${className}`} {...rest}>
        <img
          src={posterUrl}
          alt=""
          className="w-full h-full object-cover"
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
