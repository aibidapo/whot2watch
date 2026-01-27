'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

interface EmbedItem {
  name: string;
  type: string;
  releaseYear?: number;
  posterUrl?: string;
  note?: string;
}

interface EmbedList {
  id: string;
  name: string;
  description?: string;
  items: EmbedItem[];
}

/**
 * Minimal read-only list embed page.
 * - No navigation chrome
 * - Only renders PUBLIC lists
 * - "Powered by Whot2Watch" footer
 * - Designed for iframe embedding by partners
 */
export default function EmbedPage() {
  const params = useParams();
  const listId = String(params.listId || '');
  const [list, setList] = useState<EmbedList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', []);

  useEffect(() => {
    if (!listId) return;
    fetch(`${apiBase}/v1/lists/${listId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('not_found');
        return r.json();
      })
      .then((data) => {
        if (data.visibility !== 'PUBLIC') {
          setError('This list is not publicly available.');
          return;
        }
        const items: EmbedItem[] = (data.items || []).map((item: any) => ({
          name: item.title?.name || item.name || 'Unknown',
          type: item.title?.type || '',
          releaseYear: item.title?.releaseYear,
          posterUrl: item.title?.posterUrl,
          note: item.note,
        }));
        setList({ id: data.id, name: data.name, description: data.description, items });
      })
      .catch(() => setError('List not found.'))
      .finally(() => setLoading(false));
  }, [listId, apiBase]);

  if (loading) {
    return (
      <div style={styles.container}>
        <p style={styles.muted}>Loading...</p>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div style={styles.container}>
        <p style={styles.error}>{error || 'List not found.'}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>{list.name}</h2>
      {list.description && <p style={styles.description}>{list.description}</p>}

      <div style={styles.grid}>
        {list.items.map((item, i) => (
          <div key={i} style={styles.item}>
            {item.posterUrl ? (
              <img src={item.posterUrl} alt={item.name} loading="lazy" style={styles.poster} />
            ) : (
              <div style={styles.posterPlaceholder} />
            )}
            <p style={styles.itemName}>
              {item.name}
              {item.releaseYear ? ` (${item.releaseYear})` : ''}
            </p>
          </div>
        ))}
      </div>

      {list.items.length === 0 && <p style={styles.muted}>This list is empty.</p>}

      <div style={styles.footer}>
        Powered by{' '}
        <a
          href="https://whot2watch.example.com"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.footerLink}
        >
          Whot2Watch
        </a>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: 800,
    margin: '0 auto',
    padding: '16px',
    background: '#fff',
    color: '#333',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    marginBottom: 4,
  },
  description: {
    color: '#666',
    fontSize: '0.875rem',
    marginBottom: 16,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: 12,
  },
  item: {
    textAlign: 'center' as const,
  },
  poster: {
    width: '100%',
    borderRadius: 8,
    aspectRatio: '2/3',
    objectFit: 'cover' as const,
    background: '#eee',
  },
  posterPlaceholder: {
    width: '100%',
    aspectRatio: '2/3',
    background: '#eee',
    borderRadius: 8,
  },
  itemName: {
    fontSize: '0.8rem',
    marginTop: 4,
  },
  footer: {
    marginTop: 20,
    textAlign: 'center' as const,
    fontSize: '0.7rem',
    color: '#aaa',
  },
  footerLink: {
    color: '#22c55e',
    textDecoration: 'none',
  },
  muted: {
    color: '#888',
    textAlign: 'center' as const,
    padding: '2rem 0',
  },
  error: {
    color: '#b91c1c',
    textAlign: 'center' as const,
    padding: '2rem 0',
  },
};
