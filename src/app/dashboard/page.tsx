import DashboardClient from "@/components/dashboard/dashboard-client";
import { scholarshipSeed } from "@/lib/scholarships";

export default function DashboardPage() {
  return <DashboardClient scholarships={scholarshipSeed} />;
}
