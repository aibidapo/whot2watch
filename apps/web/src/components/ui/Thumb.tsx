import { HTMLAttributes } from 'react'

type ThumbProps = HTMLAttributes<HTMLDivElement> & {
  posterUrl?: string
  backdropUrl?: string
  voteAverage?: number
}

export function Thumb({ posterUrl, backdropUrl, voteAverage, className = '', ...rest }: ThumbProps) {
  // Poster first
  if (posterUrl) {
    return (
      <div className={`relative ${className}`} {...rest}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={posterUrl} alt="" className="w-full h-full object-cover" />
        {typeof voteAverage === 'number' ? (
          <span className="thumb-badge"><span className="star">★</span>{voteAverage.toFixed(1)}</span>
        ) : null}
      </div>
    )
  }
  // Backdrop second, dimmed with overlay
  if (backdropUrl) {
    return (
      <div className={`relative thumb-backdrop ${className}`} style={{ backgroundImage: `url(${backdropUrl})` }} {...rest}>
        <div className="thumb-overlay" />
        {typeof voteAverage === 'number' ? (
          <span className="thumb-badge"><span className="star">★</span>{voteAverage.toFixed(1)}</span>
        ) : null}
      </div>
    )
  }
  // Skeleton fallback
  return <div className={`skeleton ${className}`} {...rest} />
}


