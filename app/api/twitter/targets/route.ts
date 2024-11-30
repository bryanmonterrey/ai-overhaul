// app/api/twitter/targets/route.ts
import { db } from '@/lib/db';
import { TwitterEngagementSystem } from '@/core/twitter/twitter-engagement';

export async function GET() {
  const targets = await db.twitter_targets.findMany();
  return Response.json(targets);
}

export async function POST(req: Request) {
  const body = await req.json();
  const target = await db.twitter_targets.create({
    data: {
      username: body.username,
      topics: body.topics
    }
  });
  return Response.json(target);
}