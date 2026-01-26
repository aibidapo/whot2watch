import type { ChatRecommendation } from './types';

interface ChatRecommendationCardProps {
  recommendation: ChatRecommendation;
}

export function ChatRecommendationCard({
  recommendation,
}: ChatRecommendationCardProps) {
  const { title, reason, availability } = recommendation;

  return (
    <div className="card flex gap-3 p-3">
      {/* Poster */}
      <div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-md bg-accent">
        {title.posterUrl ? (
          <img
            src={title.posterUrl}
            alt={title.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted">
            No img
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-sm font-semibold">{title.name}</p>
        <p className="text-xs text-muted">
          {title.type === 'tv' ? 'TV' : 'Movie'}
          {title.releaseYear ? ` · ${title.releaseYear}` : ''}
          {title.voteAverage ? ` · ★ ${title.voteAverage.toFixed(1)}` : ''}
        </p>
        <p className="text-xs italic text-muted">{reason}</p>

        {/* Availability chips */}
        {availability && availability.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {availability.map((a) => (
              <span
                key={`${a.service}-${a.region}`}
                className="inline-block rounded-full border border-chip-border bg-chip-bg px-2 py-0.5 text-[10px] text-chip-text"
              >
                {a.service}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
