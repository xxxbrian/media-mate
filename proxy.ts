/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|warning|api/login|api/register|api/logout|api/cron|api/server-config).*)',
  ],
};

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let nextRequest = request;

  // 🔓 处理成人内容模式路径重写
  if (pathname.startsWith('/adult/')) {
    const actualPath = pathname.replace('/adult/', '/');
    const url = request.nextUrl.clone();
    url.pathname = actualPath;
    url.searchParams.set('adult', '1');

    const response = NextResponse.rewrite(url);
    response.headers.set('X-Content-Mode', 'adult');

    if (actualPath.startsWith('/api')) {
      nextRequest = new NextRequest(url, request);
    } else {
      return response;
    }
  }

  // 跳过不需要认证的路径
  if (shouldSkipAuth(nextRequest.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // if (!process.env.PASSWORD) {
  //   const warningUrl = new URL('/warning', nextRequest.url);
  //   return NextResponse.redirect(warningUrl);
  // }

  const authInfo = getAuthInfoFromCookie(nextRequest);

  if (!authInfo || !authInfo.username || !authInfo.signature) {
    return handleAuthFailure(nextRequest, pathname);
  }

  const isValidSignature = await verifySignature(
    authInfo.username,
    authInfo.signature,
    process.env.PASSWORD || ''
  );

  if (isValidSignature) {
    return NextResponse.next();
  }

  return handleAuthFailure(nextRequest, pathname);
}

async function verifySignature(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBuffer = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      messageData
    );
  } catch (error) {
    console.error('签名验证失败:', error);
    return false;
  }
}

function handleAuthFailure(
  request: NextRequest,
  pathname: string
): NextResponse {
  if (pathname.startsWith('/api')) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  const fullUrl = `${pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('redirect', fullUrl);
  return NextResponse.redirect(loginUrl);
}

function shouldSkipAuth(pathname: string): boolean {
  const skipPaths = [
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '/manifest.json',
    '/icons/',
    '/logo.png',
    '/screenshot.png',
    '/login',
    '/api/tvbox/config',
    '/api/tvbox/diagnose',
    '/register',
  ];

  return skipPaths.some((path) => pathname.startsWith(path));
}
