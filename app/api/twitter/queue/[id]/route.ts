
// app/api/twitter/queue/[id]/route.ts

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
  ) {
    try {
      const body = await req.json();
      twitterManager.updateTweetStatus(params.id, body.status);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error updating tweet status:', error);
      return NextResponse.json(
        { error: 'Failed to update tweet status' },
        { status: 500 }
      );
    }
  }