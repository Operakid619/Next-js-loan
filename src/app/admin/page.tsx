import { AdminPage } from "@/features/admin/components/admin-page";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/api/supabase-server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function getQueryParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

export default async function AdminRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { user, profile } = await requireAdmin();
  const resolvedSearchParams = await searchParams;
  const supabase = await getSupabaseServerClient();

  const [{ data: borrowersData }, { data: loansData }] = await Promise.all([
    supabase
      .from("borrowers")
      .select(
        "id, first_name, middle_name, last_name, email, occupation, guarantor_name, guarantor_occupation, phone_number, guarantor_phone_number, address, guarantor_address, borrower_id_name, borrower_id_image_path, passport_path, guarantor_id_name, guarantor_id_image_path, guarantor_passport_path, marital_status, must_change_password, created_at, updated_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("loans")
      .select(
        "id, borrower_id, principal_amount, interest_amount, total_amount_due, outstanding_total_amount, repayment_status, issued_at, due_at, consent_form_signed, has_collateral, borrowers(first_name, last_name, email)",
      )
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const noticeMessage = getQueryParam(resolvedSearchParams.message);
  const noticeStatus = getQueryParam(resolvedSearchParams.status);
  const requestedSection = getQueryParam(resolvedSearchParams.section);
  const initialSection =
    requestedSection === "borrowers" ||
    requestedSection === "loans" ||
    requestedSection === "add-borrower"
      ? requestedSection
      : "add-borrower";
  const notice =
    noticeMessage && noticeStatus === "success"
      ? {
          message: noticeMessage,
          status: "success" as const,
        }
      : noticeMessage && noticeStatus === "error"
        ? {
            message: noticeMessage,
            status: "error" as const,
          }
        : null;

  return (
    <AdminPage
      adminEmail={user.email ?? ""}
      adminName={profile.full_name ?? "Administrator"}
      notice={notice}
      borrowers={borrowersData ?? []}
      loans={loansData ?? []}
      initialSection={initialSection}
      serviceRoleConfigured={Boolean(env.SUPABASE_SERVICE_ROLE_KEY)}
    />
  );
}
