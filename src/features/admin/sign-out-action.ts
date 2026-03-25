"use server";

import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/api/supabase-server";

export async function signOutAdmin() {
  const supabase = await getSupabaseServerClient();

  await supabase.auth.signOut();
  redirect("/");
}
