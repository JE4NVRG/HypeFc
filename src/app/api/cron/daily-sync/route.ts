import { NextRequest, NextResponse } from 'next/server';
import { dailySyncService } from '@/cron/dailySync';

export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization here
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    await dailySyncService.runDailySync();

    return NextResponse.json({ 
      success: true, 
      message: 'Daily sync completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Daily sync API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Daily sync failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Allow GET for testing purposes
export async function GET() {
  return NextResponse.json({
    message: 'Daily sync endpoint is active. Use POST to trigger sync.',
    timestamp: new Date().toISOString()
  });
}