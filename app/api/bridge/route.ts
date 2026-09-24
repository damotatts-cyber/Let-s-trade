import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();

  return NextResponse.json({
    success: true,
    routedTo: body?.phone ?? null,
    amount: body?.amount ?? null,
    asset: body?.asset ?? null,
  });
}
