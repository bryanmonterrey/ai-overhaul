// app/api/twitter/queue/generate/route.ts

export async function POST() {
    try {
      await twitterManager.generateTweetBatch();
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error generating tweets:', error);
      return NextResponse.json(
        { error: 'Failed to generate tweets' },
        { status: 500 }
      );
    }
  }
  