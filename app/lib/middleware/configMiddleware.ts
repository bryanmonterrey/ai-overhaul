// src/app/lib/middleware/configMiddleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { configManager } from '../config/manager';

export function withConfig(handler: Function) {
  return async function(req: NextRequest, ...args: any[]) {
    try {
      // Validate configuration before handling request
      if (!configManager.validateConfig()) {
        return NextResponse.json(
          { error: 'Invalid system configuration' },
          { status: 500 }
        );
      }

      // Check rate limits
      const rateLimits = configManager.get('system', 'rateLimits');
      // Implement rate limiting here...

      // Check if required integrations are enabled
      const path = req.nextUrl.pathname;
      if (path.startsWith('/api/twitter') && !configManager.get('integrations', 'twitter').enabled) {
        return NextResponse.json(
          { error: 'Twitter integration is disabled' },
          { status: 403 }
        );
      }
      if (path.startsWith('/api/telegram') && !configManager.get('integrations', 'telegram').enabled) {
        return NextResponse.json(
          { error: 'Telegram integration is disabled' },
          { status: 403 }
        );
      }

      return handler(req, ...args);
    } catch (error) {
      console.error('Configuration middleware error:', error);
      return NextResponse.json(
        { error: 'Configuration error' },
        { status: 500 }
      );
    }
  };
}