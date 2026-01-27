import type { Metadata } from 'next';
import ListDetailClient from './ListDetailClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type ListDetail = {
  id: string;
  profileId: string;
  profileName: string;
  name: string;
  visibility: string;
  description?: string;
  createdAt: string;
  itemCount: number;
  items: Array<{
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
  }>;
};

async function fetchList(listId: string): Promise<ListDetail | null> {
  try {
    const res = await fetch(`${API_URL}/lists/${listId}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.list ?? null;
  } catch {
    return null;
  }
}

type PageProps = { params: Promise<{ listId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { listId } = await params;
  const list = await fetchList(listId);

  if (!list || list.visibility === 'PRIVATE') {
    return {
      title: 'Private List — Whot2Watch',
      description: 'This list is private.',
      openGraph: {
        title: 'Private List — Whot2Watch',
        description: 'This list is private.',
        type: 'website',
      },
    };
  }

  const description = list.description
    || `${list.itemCount} title${list.itemCount === 1 ? '' : 's'} curated by ${list.profileName}`;

  const firstPoster = list.items.find((i) => i.title.posterUrl)?.title.posterUrl;
  const images = firstPoster ? [{ url: firstPoster }] : [{ url: '/icon.svg' }];

  return {
    title: `${list.name} — Whot2Watch`,
    description,
    openGraph: {
      title: `${list.name} — Whot2Watch`,
      description,
      type: 'website',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${list.name} — Whot2Watch`,
      description,
      images: images.map((i) => i.url),
    },
  };
}

export default async function ListDetailPage({ params }: PageProps) {
  const { listId } = await params;
  const list = await fetchList(listId);

  return <ListDetailClient listId={listId} initialData={list} />;
}
