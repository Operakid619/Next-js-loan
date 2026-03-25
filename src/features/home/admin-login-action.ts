"use server";

import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/api/supabase-server";

export type AdminLoginState = {
  email: string;
  error: string | null;
};

export async function loginAdmin(
  _previousState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return { email: "", error: "Enter your email and password." };
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return {
      email: normalizedEmail,
      error: "Enter your email and password.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    return { email: normalizedEmail, error: "Invalid email or password." };
  }

  const userId = data.user?.id;

  if (!userId) {
    return { email: normalizedEmail, error: "Unable to start your session." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    await supabase.auth.signOut();
    return {
      email: normalizedEmail,
      error: "This account does not have admin access.",
    };
  }

  redirect("/admin");
}
