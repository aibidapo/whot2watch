/**
 * Social Analytics — Epic 9: Monetization & Growth
 *
 * Premium-gated social analytics: aggregated stats from friends' activity.
 */

import type { PrismaClient } from "@prisma/client";

export interface SocialAnalyticsData {
  topGenresAmongFriends: { genre: string; count: number }[];
  friendsWatchingNow: number;
  sharedTitles: number;
  topServicesAmongFriends: { service: string; count: number }[];
}

export async function getSocialAnalytics(
  profileId: string,
  prisma: PrismaClient,
): Promise<SocialAnalyticsData> {
  // Get accepted friends
  const friends = await prisma.friend.findMany({
    where: {
      OR: [
        { fromProfileId: profileId, status: "ACCEPTED" },
        { toProfileId: profileId, status: "ACCEPTED" },
      ],
    },
    select: { fromProfileId: true, toProfileId: true },
  });

  const friendProfileIds = friends.map((f) =>
    f.fromProfileId === profileId ? f.toProfileId : f.fromProfileId,
  );

  if (friendProfileIds.length === 0) {
    return {
      topGenresAmongFriends: [],
      friendsWatchingNow: 0,
      sharedTitles: 0,
      topServicesAmongFriends: [],
    };
  }

  // Friends' feedback for genre counting
  const friendFeedback = await prisma.feedback.findMany({
    where: {
      profileId: { in: friendProfileIds },
      action: "LIKE",
    },
    select: { titleId: true, profileId: true },
    take: 500,
  });

  // Get titles for genre aggregation
  const titleIds = [...new Set(friendFeedback.map((f) => f.titleId))];
  const titles = await prisma.title.findMany({
    where: { id: { in: titleIds } },
    select: { id: true, genres: true },
  });

  // Aggregate genres
  const genreCounts: Record<string, number> = {};
  const titleGenres = new Map(titles.map((t) => [t.id, t.genres]));
  for (const fb of friendFeedback) {
    const genres = titleGenres.get(fb.titleId) || [];
    for (const g of genres) {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    }
  }
  const topGenresAmongFriends = Object.entries(genreCounts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Friends' subscriptions for service counting
  const friendSubs = await prisma.subscription.findMany({
    where: {
      profileId: { in: friendProfileIds },
      active: true,
    },
    select: { service: true },
  });

  const serviceCounts: Record<string, number> = {};
  for (const s of friendSubs) {
    serviceCounts[s.service] = (serviceCounts[s.service] || 0) + 1;
  }
  const topServicesAmongFriends = Object.entries(serviceCounts)
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Shared titles: titles liked by both user and at least one friend
  const userFeedback = await prisma.feedback.findMany({
    where: { profileId, action: "LIKE" },
    select: { titleId: true },
  });
  const userLikedIds = new Set(userFeedback.map((f) => f.titleId));
  const friendLikedIds = new Set(friendFeedback.map((f) => f.titleId));
  const sharedTitles = [...userLikedIds].filter((id) =>
    friendLikedIds.has(id),
  ).length;

  // Recent activity count (within last 24h)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentFeedback = await prisma.feedback.count({
    where: {
      profileId: { in: friendProfileIds },
      ts: { gte: dayAgo },
    },
  });

  return {
    topGenresAmongFriends,
    friendsWatchingNow: recentFeedback,
    sharedTitles,
    topServicesAmongFriends,
  };
}
