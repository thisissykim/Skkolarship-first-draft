import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardClient from "@/components/dashboard/dashboard-client";
import { getPersonalizedScholarships } from "@/lib/onboarding/getPersonalizedScholarships";
import type { StudentProfileFull } from "@/types/onboarding";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profile: true },
  });

  const savedProfile = user?.profile?.rawExtraction as StudentProfileFull | null | undefined;
  if (!savedProfile) {
    redirect("/onboarding/upload");
  }

  const scholarships = getPersonalizedScholarships(savedProfile);

  return <DashboardClient scholarships={scholarships} />;
}
