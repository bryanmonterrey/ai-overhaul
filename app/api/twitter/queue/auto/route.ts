// app/api/twitter/queue/auto/route.ts

export async function POST(req: Request) {
    try {
      const body = await req.json();
      twitterManager.toggleAutoMode(body.enabled);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error toggling auto mode:', error);
      return NextResponse.json(
        { error: 'Failed to toggle auto mode' },
        { status: 500 }
      );
    }
  }