import { HomePage } from "@/features/home";
import { getCurrentAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const admin = await getCurrentAdmin();

  if (admin) {
    redirect("/admin");
  }

  return <HomePage />;
}
