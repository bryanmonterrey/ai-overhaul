// Refactored configMiddleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { configManager } from '../config/manager';

export function withConfig(handler: Function) {
  return async function(req: NextRequest, ...args: any[]) {
    try {
      const allowedDomains = ['terminal.goatse.app'];
      const hostname = req.headers.get('host');
      
      if (process.env.NODE_ENV === 'production' && 
          hostname && 
          !allowedDomains.includes(hostname)) {
        console.error(`Invalid domain: ${hostname}`);
        return NextResponse.json(
          { error: 'Invalid domain' },
          { status: 403 }
        );
      }
      
      if (process.env.NODE_ENV === 'development') {
        return handler(req, ...args);
      }

      const isValidConfig = configManager.validateConfig();
      if (!isValidConfig) {
        console.error('Configuration validation failed');
        return NextResponse.json(
          { error: 'Invalid system configuration' },
          { status: 500 }
        );
      }

      const path = req.nextUrl.pathname;
      if (path.startsWith('/api/twitter') && !configManager.get('integrations', 'twitter')?.enabled) {
        console.error('Twitter integration is disabled in production');
        return NextResponse.json(
          { error: 'Twitter integration is disabled' },
          { status: 403 }
        );
      }

      return handler(req, ...args);
    } catch (error) {
      console.error('Configuration middleware error:', error);
      return NextResponse.json(
        { error: 'Configuration error', details: error.message },
        { status: 500 }
      );
    }
  };
}