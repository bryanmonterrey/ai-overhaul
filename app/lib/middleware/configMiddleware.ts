import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { configManager } from '../config/manager';

export function withConfig(handler: Function) {
  return async function(req: NextRequest, ...args: any[]) {
    try {
      // In development, skip config validation
      if (process.env.NODE_ENV === 'development') {
        return handler(req, ...args);
      }

      // Validate configuration before handling request
      if (!configManager.validateConfig()) {
        return NextResponse.json(
          { error: 'Invalid system configuration' },
          { status: 500 }
        );
      }

      // Check if required integrations are enabled
      const path = req.nextUrl.pathname;
      if (path.startsWith('/api/twitter') && !configManager.get('integrations', 'twitter').enabled) {
        // In development, allow Twitter integration
        if (process.env.NODE_ENV !== 'development') {
          return NextResponse.json(
            { error: 'Twitter integration is disabled' },
            { status: 403 }
          );
        }
      }

      return handler(req, ...args);
    } catch (error) {
      console.error('Configuration middleware error:', error);
      // In development, continue despite errors
      if (process.env.NODE_ENV === 'development') {
        return handler(req, ...args);
      }
      return NextResponse.json(
        { error: 'Configuration error' },
        { status: 500 }
      );
    }
  };
}