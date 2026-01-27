
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './lib/auth';

export async function middleware(request: NextRequest) {
    const sessionCookie = request.cookies.get('session')?.value;
    const session = await decrypt(sessionCookie || '');

    // Si intenta entrar al dashboard sin sesión -> Login
    if (request.nextUrl.pathname.startsWith('/dashboard') && !session) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Si intenta entrar al login con sesión -> Dashboard
    if (request.nextUrl.pathname.startsWith('/login') && session) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*', '/login'],
};
