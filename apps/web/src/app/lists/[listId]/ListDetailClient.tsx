'use client';

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Thumb } from '@/components/ui/Thumb';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';

type ListItem = {
  id: string;
  position: number | null;
  note?: string;
  addedAt: string;
  title: {
    id: string;
    name: string;
    type: string;
    releaseYear?: number;
    posterUrl?: string;
    backdropUrl?: string;
    voteAverage?: number;
    genres: string[];
  };
};

type ListDetail = {
  id: string;
  profileId: string;
  profileName: string;
  name: string;
  visibility: string;
  description?: string;
  createdAt: string;
  itemCount: number;
  items: ListItem[];
};

type Props = {
  listId: string;
  initialData: ListDetail | null;
};

export default function ListDetailClient({ listId, initialData }: Props) {
  const [copied, setCopied] = useState(false);

  if (!initialData) {
    return (
      <div className="grid gap-4">
        <Card>
          <p className="text-muted text-center py-8">List not found or not accessible.</p>
        </Card>
      </div>
    );
  }

  const list = initialData;
  const isShareable = list.visibility === 'PUBLIC' || list.visibility === 'COLLAB';

  async function handleShare() {
    const url = `${window.location.origin}/lists/${listId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: list.name, url });
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <div className="grid gap-4">
      {/* Header */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{list.name}</h1>
            <p className="text-muted text-sm mt-1">
              by {list.profileName} &middot; {list.itemCount} title{list.itemCount === 1 ? '' : 's'}
            </p>
            {list.description && <p className="text-sm mt-2">{list.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Chip>{list.visibility}</Chip>
            {isShareable && (
              <Button variant="secondary" onClick={handleShare}>
                {copied ? 'Copied!' : 'Share'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Title grid */}
      {list.items.length === 0 ? (
        <Card>
          <p className="text-muted text-center py-8">This list is empty.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {list.items.map((item) => (
            <Card key={item.id} className="p-0 overflow-hidden">
              <Thumb
                posterUrl={item.title.posterUrl}
                backdropUrl={item.title.backdropUrl}
                voteAverage={item.title.voteAverage}
                className="aspect-[2/3] w-full"
              />
              <div className="p-2">
                <p className="font-medium text-sm truncate">{item.title.name}</p>
                <p className="text-muted text-xs">
                  {item.title.type === 'SHOW' ? 'TV' : 'Movie'}
                  {item.title.releaseYear ? ` · ${item.title.releaseYear}` : ''}
                </p>
                {item.note && <p className="text-xs text-muted mt-1 truncate">{item.note}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
