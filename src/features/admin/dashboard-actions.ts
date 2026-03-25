"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/api/supabase-admin";
import { getSupabaseServerClient } from "@/lib/api/supabase-server";

const BORROWER_DOCUMENT_BUCKET = "borrower-documents";
const MAX_DOCUMENT_SIZE_IN_BYTES = 5 * 1024 * 1024;

type SupabaseAdminClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;
type ErrorMode = "redirect" | "throw";

type BorrowerDraftPayload = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  password: string;
  occupation: string;
  guarantorName: string;
  guarantorOccupation: string;
  phoneNumber: string;
  guarantorPhoneNumber: string;
  address: string;
  guarantorAddress: string;
  borrowerIdName: string;
  guarantorIdName: string;
  maritalStatus: string;
  borrowerIdImageFile: File | null;
  borrowerPassportImageFile: File | null;
  guarantorIdImageFile: File | null;
  guarantorPassportImageFile: File | null;
};

export type BorrowerDraftActionResult = {
  status: "success" | "error";
  message: string;
};

class AdminActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminActionError";
  }
}

function handleActionError(message: string, mode: ErrorMode): never {
  if (mode === "throw") {
    throw new AdminActionError(message);
  }

  redirectToAdmin("error", message);
}

function redirectToAdmin(
  status: "success" | "error",
  message: string,
  section?: "add-borrower" | "borrowers" | "loans",
): never {
  const searchParams = new URLSearchParams({
    status,
    message,
  });

  if (section) {
    searchParams.set("section", section);
  }

  redirect(`/admin?${searchParams.toString()}`);
}

function getTrimmedString(
  formData: FormData,
  fieldName: string,
  options?: { required?: boolean },
) {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return options?.required ? null : "";
  }

  const trimmedValue = value.trim();

  if (options?.required && !trimmedValue) {
    return null;
  }

  return trimmedValue;
}

function parseAmount(formData: FormData, fieldName: string) {
  const rawValue = getTrimmedString(formData, fieldName, { required: true });

  if (!rawValue) {
    return null;
  }

  const numericValue = Number(rawValue);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return numericValue;
}

function parseDateTime(rawValue: string | null, endOfDay = false) {
  if (!rawValue) {
    return null;
  }

  const normalizedValue = endOfDay
    ? `${rawValue}T23:59:59.000Z`
    : `${rawValue}T00:00:00.000Z`;
  const dateValue = new Date(normalizedValue);

  if (Number.isNaN(dateValue.getTime())) {
    return null;
  }

  return dateValue.toISOString();
}

function getImageFile(
  formData: FormData,
  fieldName: string,
  mode: ErrorMode = "redirect",
) {
  const value = formData.get(fieldName);

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  if (!value.type.startsWith("image/")) {
    handleActionError("Proof of ID files must be images.", mode);
  }

  if (value.size > MAX_DOCUMENT_SIZE_IN_BYTES) {
    handleActionError(
      "Each proof of ID image must be 5MB or smaller.",
      mode,
    );
  }

  return value;
}

function getFileExtension(file: File) {
  const fileNameParts = file.name.split(".");

  if (fileNameParts.length > 1) {
    return fileNameParts[fileNameParts.length - 1]!.toLowerCase();
  }

  const contentType = file.type.toLowerCase();

  if (contentType === "image/png") {
    return "png";
  }

  if (contentType === "image/webp") {
    return "webp";
  }

  if (contentType === "image/gif") {
    return "gif";
  }

  return "jpg";
}

async function uploadBorrowerDocument({
  supabaseAdmin,
  borrowerId,
  file,
  folder,
  mode = "redirect",
}: {
  supabaseAdmin: SupabaseAdminClient;
  borrowerId: string;
  file: File;
  folder:
    | "borrower-id"
    | "borrower-passport"
    | "guarantor-id"
    | "guarantor-passport";
  mode?: ErrorMode;
}) {
  const extension = getFileExtension(file);
  const path = `${borrowerId}/${folder}-${randomUUID()}.${extension}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabaseAdmin.storage
    .from(BORROWER_DOCUMENT_BUCKET)
    .upload(path, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    handleActionError(
      error.message ?? "Unable to upload the proof of ID image.",
      mode,
    );
  }

  return path;
}

async function removeBorrowerDocuments(
  supabaseAdmin: SupabaseAdminClient,
  paths: Array<string | null | undefined>,
) {
  const pathsToRemove = paths.filter((path): path is string => Boolean(path));

  if (pathsToRemove.length === 0) {
    return;
  }

  await supabaseAdmin.storage
    .from(BORROWER_DOCUMENT_BUCKET)
    .remove(pathsToRemove);
}

function getActionMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  if (error instanceof AdminActionError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function parseBorrowerDraft(
  formData: FormData,
  mode: ErrorMode,
): BorrowerDraftPayload {
  const firstName = getTrimmedString(formData, "first_name", { required: true });
  const middleName = getTrimmedString(formData, "middle_name");
  const lastName = getTrimmedString(formData, "last_name", { required: true });
  const email = getTrimmedString(formData, "email", { required: true });
  const password = getTrimmedString(formData, "password", { required: true });
  const occupation = getTrimmedString(formData, "occupation");
  const guarantorName = getTrimmedString(formData, "guarantor_name");
  const guarantorOccupation = getTrimmedString(formData, "guarantor_occupation");
  const phoneNumber = getTrimmedString(formData, "phone_number", {
    required: true,
  });
  const guarantorPhoneNumber = getTrimmedString(
    formData,
    "guarantor_phone_number",
  );
  const address = getTrimmedString(formData, "address");
  const guarantorAddress = getTrimmedString(formData, "guarantor_address");
  const borrowerIdName = getTrimmedString(formData, "borrower_id_name");
  const guarantorIdName = getTrimmedString(formData, "guarantor_id_name");
  const maritalStatus = getTrimmedString(formData, "marital_status", {
    required: true,
  });
  const borrowerIdImageFile = getImageFile(formData, "borrower_id_image", mode);
  const borrowerPassportImageFile = getImageFile(
    formData,
    "borrower_passport_image",
    mode,
  );
  const guarantorIdImageFile = getImageFile(
    formData,
    "guarantor_id_image",
    mode,
  );
  const guarantorPassportImageFile = getImageFile(
    formData,
    "guarantor_passport_image",
    mode,
  );

  if (
    !firstName ||
    !lastName ||
    !email ||
    !password ||
    !phoneNumber ||
    !maritalStatus
  ) {
    handleActionError("Complete all required borrower details.", mode);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    handleActionError("Enter a valid email address.", mode);
  }

  if (
    guarantorPhoneNumber &&
    phoneNumber &&
    guarantorPhoneNumber === phoneNumber
  ) {
    handleActionError(
      "Borrower and guarantor cannot use the same phone number.",
      mode,
    );
  }

  if (
    (borrowerIdImageFile && !borrowerIdName) ||
    (!borrowerIdImageFile && borrowerIdName)
  ) {
    handleActionError(
      "Add both the borrower ID name and the borrower ID image.",
      mode,
    );
  }

  if (
    (guarantorIdImageFile && !guarantorIdName) ||
    (!guarantorIdImageFile && guarantorIdName)
  ) {
    handleActionError(
      "Add both the guarantor ID name and the guarantor ID image.",
      mode,
    );
  }

  return {
    firstName: firstName ?? "",
    middleName: middleName ?? "",
    lastName: lastName ?? "",
    email: (email ?? "").toLowerCase(),
    password: password ?? "",
    occupation: occupation ?? "",
    guarantorName: guarantorName ?? "",
    guarantorOccupation: guarantorOccupation ?? "",
    phoneNumber: phoneNumber ?? "",
    guarantorPhoneNumber: guarantorPhoneNumber ?? "",
    address: address ?? "",
    guarantorAddress: guarantorAddress ?? "",
    borrowerIdName: borrowerIdName ?? "",
    guarantorIdName: guarantorIdName ?? "",
    maritalStatus: maritalStatus ?? "",
    borrowerIdImageFile,
    borrowerPassportImageFile,
    guarantorIdImageFile,
    guarantorPassportImageFile,
  };
}

async function ensureBorrowerDraftIsUnique(
  draft: BorrowerDraftPayload,
  options?: { excludeBorrowerId?: string; mode?: ErrorMode },
) {
  const supabase = await getSupabaseServerClient();
  const excludeBorrowerId = options?.excludeBorrowerId;
  const mode = options?.mode ?? "throw";
  const buildLookup = (
    column: "email" | "phone_number" | "guarantor_phone_number",
    value: string,
  ) => {
    let query = supabase.from("borrowers").select("id");

    if (column === "email") {
      query = query.ilike("email", value);
    } else {
      query = query.eq(column, value);
    }

    if (excludeBorrowerId) {
      query = query.neq("id", excludeBorrowerId);
    }

    return query.limit(1).maybeSingle();
  };
  const [
    { data: matchingEmail },
    { data: matchingBorrowerPhone },
    { data: matchingGuarantorPhoneForBorrowerPhone },
    { data: matchingBorrowerPhoneForGuarantorPhone },
    { data: matchingGuarantorPhone },
  ] = await Promise.all([
    draft.email ? buildLookup("email", draft.email) : Promise.resolve({ data: null }),
    buildLookup("phone_number", draft.phoneNumber),
    buildLookup("guarantor_phone_number", draft.phoneNumber),
    draft.guarantorPhoneNumber
      ? buildLookup("phone_number", draft.guarantorPhoneNumber)
      : Promise.resolve({ data: null }),
    draft.guarantorPhoneNumber
      ? buildLookup("guarantor_phone_number", draft.guarantorPhoneNumber)
      : Promise.resolve({ data: null }),
  ]);

  if (matchingEmail) {
    handleActionError("A borrower with this email already exists.", mode);
  }

  if (matchingBorrowerPhone || matchingGuarantorPhoneForBorrowerPhone) {
    handleActionError(
      "A borrower with this phone number already exists.",
      mode,
    );
  }

  if (matchingBorrowerPhoneForGuarantorPhone || matchingGuarantorPhone) {
    handleActionError(
      "That guarantor phone number is already used in another record.",
      mode,
    );
  }
}

export async function updateAdminProfile(formData: FormData) {
  const admin = await requireAdmin();
  const fullName = getTrimmedString(formData, "full_name", { required: true });

  if (!fullName) {
    redirectToAdmin("error", "Enter your name before saving.");
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", admin.user.id);

  if (error) {
    redirectToAdmin("error", "Unable to update your profile right now.");
  }

  revalidatePath("/admin");
  redirectToAdmin("success", "Profile updated successfully.");
}

export async function validateBorrowerDraft(
  formData: FormData,
): Promise<BorrowerDraftActionResult> {
  try {
    await requireAdmin();

    if (!getSupabaseAdminClient()) {
      throw new AdminActionError(
        "Borrower account creation needs SUPABASE_SERVICE_ROLE_KEY on the server.",
      );
    }

    const draft = parseBorrowerDraft(formData, "throw");
    await ensureBorrowerDraftIsUnique(draft);

    return {
      status: "success",
      message:
        "Information verified. Review the details, download the PDF if needed, then finish.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getActionMessage(error),
    };
  }
}

export async function finalizeBorrowerDraft(
  formData: FormData,
): Promise<BorrowerDraftActionResult> {
  let createdUserId: string | null = null;
  let supabaseAdmin: SupabaseAdminClient | null = null;
  const uploadedPaths: string[] = [];

  try {
    const admin = await requireAdmin();
    supabaseAdmin = getSupabaseAdminClient();

    if (!supabaseAdmin) {
      throw new AdminActionError(
        "Borrower account creation needs SUPABASE_SERVICE_ROLE_KEY on the server.",
      );
    }

    const draft = parseBorrowerDraft(formData, "throw");
    await ensureBorrowerDraftIsUnique(draft);

    const { data: createdUserData, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email: draft.email,
        password: draft.password,
        email_confirm: true,
        user_metadata: {
          full_name: [draft.firstName, draft.middleName, draft.lastName]
            .filter(Boolean)
            .join(" "),
        },
      });

    if (createUserError || !createdUserData.user) {
      throw new AdminActionError(
        createUserError?.message ?? "Unable to create borrower login.",
      );
    }

    createdUserId = createdUserData.user.id;

    const borrowerIdImagePath = draft.borrowerIdImageFile
      ? await uploadBorrowerDocument({
          supabaseAdmin,
          borrowerId: createdUserId,
          file: draft.borrowerIdImageFile,
          folder: "borrower-id",
          mode: "throw",
        })
      : null;
    const borrowerPassportPath = draft.borrowerPassportImageFile
      ? await uploadBorrowerDocument({
          supabaseAdmin,
          borrowerId: createdUserId,
          file: draft.borrowerPassportImageFile,
          folder: "borrower-passport",
          mode: "throw",
        })
      : null;
    const guarantorIdImagePath = draft.guarantorIdImageFile
      ? await uploadBorrowerDocument({
          supabaseAdmin,
          borrowerId: createdUserId,
          file: draft.guarantorIdImageFile,
          folder: "guarantor-id",
          mode: "throw",
        })
      : null;
    const guarantorPassportPath = draft.guarantorPassportImageFile
      ? await uploadBorrowerDocument({
          supabaseAdmin,
          borrowerId: createdUserId,
          file: draft.guarantorPassportImageFile,
          folder: "guarantor-passport",
          mode: "throw",
        })
      : null;

    if (borrowerIdImagePath) {
      uploadedPaths.push(borrowerIdImagePath);
    }

    if (borrowerPassportPath) {
      uploadedPaths.push(borrowerPassportPath);
    }

    if (guarantorIdImagePath) {
      uploadedPaths.push(guarantorIdImagePath);
    }

    if (guarantorPassportPath) {
      uploadedPaths.push(guarantorPassportPath);
    }

    const { error: insertBorrowerError } = await supabaseAdmin
      .from("borrowers")
      .insert({
        id: createdUserId,
        created_by: admin.user.id,
        first_name: draft.firstName,
        middle_name: draft.middleName || null,
        last_name: draft.lastName,
        email: draft.email,
        occupation: draft.occupation || null,
        guarantor_name: draft.guarantorName || null,
        guarantor_occupation: draft.guarantorOccupation || null,
        phone_number: draft.phoneNumber,
        guarantor_phone_number: draft.guarantorPhoneNumber || null,
        address: draft.address || null,
        guarantor_address: draft.guarantorAddress || null,
        borrower_id_name: draft.borrowerIdName || null,
        borrower_id_image_path: borrowerIdImagePath,
        passport_path: borrowerPassportPath,
        guarantor_id_name: draft.guarantorIdName || null,
        guarantor_id_image_path: guarantorIdImagePath,
        guarantor_passport_path: guarantorPassportPath,
        marital_status: draft.maritalStatus,
        must_change_password: true,
      });

    if (insertBorrowerError) {
      throw new AdminActionError(
        insertBorrowerError.message ?? "Unable to save borrower details.",
      );
    }

    revalidatePath("/admin");

    return {
      status: "success",
      message: "Borrower account created successfully.",
    };
  } catch (error) {
    if (supabaseAdmin && uploadedPaths.length > 0) {
      await removeBorrowerDocuments(supabaseAdmin, uploadedPaths);
    }

    if (supabaseAdmin && createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
    }

    return {
      status: "error",
      message: getActionMessage(error),
    };
  }
}

export async function createBorrower(formData: FormData) {
  const admin = await requireAdmin();
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAdmin) {
    redirectToAdmin(
      "error",
      "Borrower account creation needs SUPABASE_SERVICE_ROLE_KEY on the server.",
    );
  }

  const firstName = getTrimmedString(formData, "first_name", { required: true });
  const middleName = getTrimmedString(formData, "middle_name");
  const lastName = getTrimmedString(formData, "last_name", { required: true });
  const email = getTrimmedString(formData, "email", { required: true });
  const password = getTrimmedString(formData, "password", { required: true });
  const occupation = getTrimmedString(formData, "occupation");
  const guarantorName = getTrimmedString(formData, "guarantor_name");
  const guarantorOccupation = getTrimmedString(formData, "guarantor_occupation");
  const phoneNumber = getTrimmedString(formData, "phone_number", {
    required: true,
  });
  const guarantorPhoneNumber = getTrimmedString(
    formData,
    "guarantor_phone_number",
  );
  const address = getTrimmedString(formData, "address");
  const guarantorAddress = getTrimmedString(formData, "guarantor_address");
  const borrowerIdName = getTrimmedString(formData, "borrower_id_name");
  const guarantorIdName = getTrimmedString(formData, "guarantor_id_name");
  const maritalStatus = getTrimmedString(formData, "marital_status", {
    required: true,
  });
  const borrowerIdImageFile = getImageFile(formData, "borrower_id_image");
  const borrowerPassportImageFile = getImageFile(
    formData,
    "borrower_passport_image",
  );
  const guarantorIdImageFile = getImageFile(formData, "guarantor_id_image");
  const guarantorPassportImageFile = getImageFile(
    formData,
    "guarantor_passport_image",
  );

  if (
    !firstName ||
    !lastName ||
    !email ||
    !password ||
    !phoneNumber ||
    !maritalStatus
  ) {
    redirectToAdmin("error", "Complete all required borrower details.");
  }

  if ((borrowerIdImageFile && !borrowerIdName) || (!borrowerIdImageFile && borrowerIdName)) {
    redirectToAdmin(
      "error",
      "Add both the borrower ID name and the borrower ID image.",
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirectToAdmin("error", "Enter a valid email address.");
  }

  if (
    guarantorPhoneNumber &&
    phoneNumber &&
    guarantorPhoneNumber === phoneNumber
  ) {
    redirectToAdmin(
      "error",
      "Borrower and guarantor cannot use the same phone number.",
    );
  }

  if (
    (guarantorIdImageFile && !guarantorIdName) ||
    (!guarantorIdImageFile && guarantorIdName)
  ) {
    redirectToAdmin(
      "error",
      "Add both the guarantor ID name and the guarantor ID image.",
    );
  }

  const normalizedEmail = email.toLowerCase();

  await ensureBorrowerDraftIsUnique({
    firstName,
    middleName: middleName ?? "",
    lastName,
    email: normalizedEmail,
    password,
    occupation: occupation ?? "",
    guarantorName: guarantorName ?? "",
    guarantorOccupation: guarantorOccupation ?? "",
    phoneNumber,
    guarantorPhoneNumber: guarantorPhoneNumber ?? "",
    address: address ?? "",
    guarantorAddress: guarantorAddress ?? "",
    borrowerIdName: borrowerIdName ?? "",
    guarantorIdName: guarantorIdName ?? "",
    maritalStatus,
    borrowerIdImageFile,
    borrowerPassportImageFile,
    guarantorIdImageFile,
    guarantorPassportImageFile,
  }, { mode: "redirect" });

  const { data: createdUserData, error: createUserError } =
    await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: [firstName, middleName, lastName].filter(Boolean).join(" "),
      },
    });

  if (createUserError || !createdUserData.user) {
    redirectToAdmin(
      "error",
      createUserError?.message ?? "Unable to create borrower login.",
    );
  }

  const uploadedPaths: string[] = [];
  const borrowerIdImagePath = borrowerIdImageFile
    ? await uploadBorrowerDocument({
        supabaseAdmin,
        borrowerId: createdUserData.user.id,
        file: borrowerIdImageFile,
        folder: "borrower-id",
      })
    : null;
  const borrowerPassportPath = borrowerPassportImageFile
    ? await uploadBorrowerDocument({
        supabaseAdmin,
        borrowerId: createdUserData.user.id,
        file: borrowerPassportImageFile,
        folder: "borrower-passport",
      })
    : null;
  const guarantorIdImagePath = guarantorIdImageFile
    ? await uploadBorrowerDocument({
        supabaseAdmin,
        borrowerId: createdUserData.user.id,
        file: guarantorIdImageFile,
        folder: "guarantor-id",
      })
    : null;
  const guarantorPassportPath = guarantorPassportImageFile
    ? await uploadBorrowerDocument({
        supabaseAdmin,
        borrowerId: createdUserData.user.id,
        file: guarantorPassportImageFile,
        folder: "guarantor-passport",
      })
    : null;

  if (borrowerIdImagePath) {
    uploadedPaths.push(borrowerIdImagePath);
  }

  if (borrowerPassportPath) {
    uploadedPaths.push(borrowerPassportPath);
  }

  if (guarantorIdImagePath) {
    uploadedPaths.push(guarantorIdImagePath);
  }

  if (guarantorPassportPath) {
    uploadedPaths.push(guarantorPassportPath);
  }

  const { error: insertBorrowerError } = await supabaseAdmin
    .from("borrowers")
    .insert({
      id: createdUserData.user.id,
      created_by: admin.user.id,
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      email: normalizedEmail,
      occupation: occupation || null,
      guarantor_name: guarantorName || null,
      guarantor_occupation: guarantorOccupation || null,
      phone_number: phoneNumber,
      guarantor_phone_number: guarantorPhoneNumber || null,
      address: address || null,
      guarantor_address: guarantorAddress || null,
      borrower_id_name: borrowerIdName || null,
      borrower_id_image_path: borrowerIdImagePath,
      passport_path: borrowerPassportPath,
      guarantor_id_name: guarantorIdName || null,
      guarantor_id_image_path: guarantorIdImagePath,
      guarantor_passport_path: guarantorPassportPath,
      marital_status: maritalStatus,
      must_change_password: true,
    });

  if (insertBorrowerError) {
    await removeBorrowerDocuments(supabaseAdmin, uploadedPaths);
    await supabaseAdmin.auth.admin.deleteUser(createdUserData.user.id);
    redirectToAdmin(
      "error",
      insertBorrowerError.message ?? "Unable to save borrower details.",
    );
  }

  revalidatePath("/admin");
  redirectToAdmin("success", "Borrower account created.");
}

export async function updateBorrower(formData: FormData) {
  await requireAdmin();

  const borrowerId = getTrimmedString(formData, "borrower_id", {
    required: true,
  });
  const firstName = getTrimmedString(formData, "first_name", { required: true });
  const middleName = getTrimmedString(formData, "middle_name");
  const lastName = getTrimmedString(formData, "last_name", { required: true });
  const occupation = getTrimmedString(formData, "occupation");
  const guarantorName = getTrimmedString(formData, "guarantor_name");
  const guarantorOccupation = getTrimmedString(formData, "guarantor_occupation");
  const phoneNumber = getTrimmedString(formData, "phone_number", {
    required: true,
  });
  const guarantorPhoneNumber = getTrimmedString(
    formData,
    "guarantor_phone_number",
  );
  const address = getTrimmedString(formData, "address");
  const guarantorAddress = getTrimmedString(formData, "guarantor_address");
  const borrowerIdName = getTrimmedString(formData, "borrower_id_name");
  const guarantorIdName = getTrimmedString(formData, "guarantor_id_name");
  const maritalStatus = getTrimmedString(formData, "marital_status", {
    required: true,
  });
  const borrowerIdImageFile = getImageFile(formData, "borrower_id_image");
  const borrowerPassportImageFile = getImageFile(
    formData,
    "borrower_passport_image",
  );
  const guarantorIdImageFile = getImageFile(formData, "guarantor_id_image");
  const guarantorPassportImageFile = getImageFile(
    formData,
    "guarantor_passport_image",
  );

  if (
    !borrowerId ||
    !firstName ||
    !lastName ||
    !phoneNumber ||
    !maritalStatus
  ) {
    redirectToAdmin(
      "error",
      "Borrower update is missing required values.",
      "borrowers",
    );
  }

  if (
    guarantorPhoneNumber &&
    phoneNumber &&
    guarantorPhoneNumber === phoneNumber
  ) {
    redirectToAdmin(
      "error",
      "Borrower and guarantor cannot use the same phone number.",
      "borrowers",
    );
  }

  await ensureBorrowerDraftIsUnique(
    {
      firstName,
      middleName: middleName ?? "",
      lastName,
      email: "",
      password: "",
      occupation: occupation ?? "",
      guarantorName: guarantorName ?? "",
      guarantorOccupation: guarantorOccupation ?? "",
      phoneNumber,
      guarantorPhoneNumber: guarantorPhoneNumber ?? "",
      address: address ?? "",
      guarantorAddress: guarantorAddress ?? "",
      borrowerIdName: borrowerIdName ?? "",
      guarantorIdName: guarantorIdName ?? "",
      maritalStatus,
      borrowerIdImageFile,
      borrowerPassportImageFile,
      guarantorIdImageFile,
      guarantorPassportImageFile,
    },
    { excludeBorrowerId: borrowerId, mode: "redirect" },
  );

  const supabase = await getSupabaseServerClient();
  const supabaseAdmin = getSupabaseAdminClient();
  const shouldUploadFiles = Boolean(
    borrowerIdImageFile ||
      borrowerPassportImageFile ||
      guarantorIdImageFile ||
      guarantorPassportImageFile,
  );

  if (shouldUploadFiles && !supabaseAdmin) {
    redirectToAdmin(
      "error",
      "Proof of ID uploads need SUPABASE_SERVICE_ROLE_KEY on the server.",
      "borrowers",
    );
  }

  const { data: existingBorrower, error: existingBorrowerError } = await supabase
    .from("borrowers")
    .select(
      "borrower_id_image_path, passport_path, guarantor_id_image_path, guarantor_passport_path",
    )
    .eq("id", borrowerId)
    .maybeSingle();

  if (existingBorrowerError) {
    redirectToAdmin(
      "error",
      existingBorrowerError.message ??
        "Unable to load the borrower before updating.",
      "borrowers",
    );
  }

  const borrowerIdImagePath =
    borrowerIdImageFile && supabaseAdmin
      ? await uploadBorrowerDocument({
          supabaseAdmin,
          borrowerId,
          file: borrowerIdImageFile,
          folder: "borrower-id",
        })
      : existingBorrower?.borrower_id_image_path ?? null;
  const borrowerPassportPath =
    borrowerPassportImageFile && supabaseAdmin
      ? await uploadBorrowerDocument({
          supabaseAdmin,
          borrowerId,
          file: borrowerPassportImageFile,
          folder: "borrower-passport",
        })
      : existingBorrower?.passport_path ?? null;
  const guarantorIdImagePath =
    guarantorIdImageFile && supabaseAdmin
      ? await uploadBorrowerDocument({
          supabaseAdmin,
          borrowerId,
          file: guarantorIdImageFile,
          folder: "guarantor-id",
        })
      : existingBorrower?.guarantor_id_image_path ?? null;
  const guarantorPassportPath =
    guarantorPassportImageFile && supabaseAdmin
      ? await uploadBorrowerDocument({
          supabaseAdmin,
          borrowerId,
          file: guarantorPassportImageFile,
          folder: "guarantor-passport",
        })
      : existingBorrower?.guarantor_passport_path ?? null;

  if (Boolean(borrowerIdName) !== Boolean(borrowerIdImagePath)) {
    if (supabaseAdmin) {
      await removeBorrowerDocuments(supabaseAdmin, [
        borrowerIdImageFile ? borrowerIdImagePath : null,
        borrowerPassportImageFile ? borrowerPassportPath : null,
        guarantorIdImageFile ? guarantorIdImagePath : null,
        guarantorPassportImageFile ? guarantorPassportPath : null,
      ]);
    }

    redirectToAdmin(
      "error",
      "Add both the borrower ID name and the borrower ID image.",
      "borrowers",
    );
  }

  if (Boolean(guarantorIdName) !== Boolean(guarantorIdImagePath)) {
    if (supabaseAdmin) {
      await removeBorrowerDocuments(supabaseAdmin, [
        borrowerIdImageFile ? borrowerIdImagePath : null,
        borrowerPassportImageFile ? borrowerPassportPath : null,
        guarantorIdImageFile ? guarantorIdImagePath : null,
        guarantorPassportImageFile ? guarantorPassportPath : null,
      ]);
    }

    redirectToAdmin(
      "error",
      "Add both the guarantor ID name and the guarantor ID image.",
      "borrowers",
    );
  }

  const { error } = await supabase
    .from("borrowers")
    .update({
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      occupation: occupation || null,
      guarantor_name: guarantorName || null,
      guarantor_occupation: guarantorOccupation || null,
      phone_number: phoneNumber,
      guarantor_phone_number: guarantorPhoneNumber || null,
      address: address || null,
      guarantor_address: guarantorAddress || null,
      borrower_id_name: borrowerIdName || null,
      borrower_id_image_path: borrowerIdImagePath,
      passport_path: borrowerPassportPath,
      guarantor_id_name: guarantorIdName || null,
      guarantor_id_image_path: guarantorIdImagePath,
      guarantor_passport_path: guarantorPassportPath,
      marital_status: maritalStatus,
    })
    .eq("id", borrowerId);

  if (error) {
    if (supabaseAdmin) {
      await removeBorrowerDocuments(supabaseAdmin, [
        borrowerIdImageFile ? borrowerIdImagePath : null,
        borrowerPassportImageFile ? borrowerPassportPath : null,
        guarantorIdImageFile ? guarantorIdImagePath : null,
        guarantorPassportImageFile ? guarantorPassportPath : null,
      ]);
    }
    redirectToAdmin(
      "error",
      error.message ?? "Unable to update the borrower right now.",
      "borrowers",
    );
  }

  if (supabaseAdmin) {
    await removeBorrowerDocuments(supabaseAdmin, [
      borrowerIdImageFile ? existingBorrower?.borrower_id_image_path : null,
      borrowerPassportImageFile ? existingBorrower?.passport_path : null,
      guarantorIdImageFile ? existingBorrower?.guarantor_id_image_path : null,
      guarantorPassportImageFile
        ? existingBorrower?.guarantor_passport_path
        : null,
    ]);
  }

  revalidatePath("/admin");
  redirectToAdmin("success", "Borrower updated.", "borrowers");
}

export async function deleteBorrower(formData: FormData) {
  await requireAdmin();
  const borrowerId = getTrimmedString(formData, "borrower_id", {
    required: true,
  });
  const supabaseAdmin = getSupabaseAdminClient();

  if (!borrowerId) {
    redirectToAdmin("error", "Borrower ID is missing.", "borrowers");
  }

  if (!supabaseAdmin) {
    redirectToAdmin(
      "error",
      "Borrower deletion needs SUPABASE_SERVICE_ROLE_KEY on the server.",
      "borrowers",
    );
  }

  const { data: existingBorrower } = await supabaseAdmin
    .from("borrowers")
    .select(
      "borrower_id_image_path, passport_path, guarantor_id_image_path, guarantor_passport_path",
    )
    .eq("id", borrowerId)
    .maybeSingle();

  const { error } = await supabaseAdmin.auth.admin.deleteUser(borrowerId);

  if (error) {
    redirectToAdmin(
      "error",
      error.message ?? "Unable to delete borrower.",
      "borrowers",
    );
  }

  await removeBorrowerDocuments(supabaseAdmin, [
    existingBorrower?.borrower_id_image_path,
    existingBorrower?.passport_path,
    existingBorrower?.guarantor_id_image_path,
    existingBorrower?.guarantor_passport_path,
  ]);

  revalidatePath("/admin");
  redirectToAdmin("success", "Borrower removed.", "borrowers");
}

export async function createLoan(formData: FormData) {
  const admin = await requireAdmin();
  const borrowerId = getTrimmedString(formData, "borrower_id", {
    required: true,
  });
  const principalAmount = parseAmount(formData, "principal_amount");
  const interestAmount = parseAmount(formData, "interest_amount");
  const issuedAt = parseDateTime(
    getTrimmedString(formData, "issued_at", { required: true }),
  );
  const dueAt = parseDateTime(
    getTrimmedString(formData, "due_at", { required: true }),
    true,
  );
  const notes = getTrimmedString(formData, "notes");
  const hasCollateral = formData.get("has_collateral") === "on";
  const collateralName = getTrimmedString(formData, "collateral_name");
  const collateralDescription = getTrimmedString(
    formData,
    "collateral_description",
  );
  const collateralImagePath = getTrimmedString(formData, "collateral_image_path");
  const consentFormSigned = formData.get("consent_form_signed") === "on";

  if (
    !borrowerId ||
    principalAmount === null ||
    interestAmount === null ||
    !issuedAt ||
    !dueAt
  ) {
    redirectToAdmin("error", "Complete the required loan fields.", "loans");
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("loans").insert({
    borrower_id: borrowerId,
    created_by: admin.user.id,
    principal_amount: principalAmount,
    interest_amount: interestAmount,
    issued_at: issuedAt,
    due_at: dueAt,
    notes: notes || null,
    has_collateral: hasCollateral,
    collateral_name: hasCollateral ? collateralName || null : null,
    collateral_description: hasCollateral
      ? collateralDescription || null
      : null,
    collateral_image_path: hasCollateral ? collateralImagePath || null : null,
    consent_form_signed: consentFormSigned,
  });

  if (error) {
    redirectToAdmin(
      "error",
      error.message ?? "Unable to create the loan.",
      "loans",
    );
  }

  revalidatePath("/admin");
  redirectToAdmin("success", "Loan issued successfully.", "loans");
}
