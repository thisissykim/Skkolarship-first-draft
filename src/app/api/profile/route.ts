import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profile: true },
  });

  return NextResponse.json({ profile: user?.profile?.rawExtraction ?? null });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  await prisma.studentProfile.upsert({
    where: { userId: user.id },
    update: { rawExtraction: body },
    create: { userId: user.id, rawExtraction: body },
  });

  return NextResponse.json({ ok: true });
}
