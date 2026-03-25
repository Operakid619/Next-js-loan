"use client";

import { jsPDF } from "jspdf";
import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Toaster, toast as notify } from "sonner";

import {
  type BorrowerDraftActionResult,
  createLoan,
  deleteBorrower,
  finalizeBorrowerDraft,
  updateBorrower,
  validateBorrowerDraft,
} from "@/features/admin/dashboard-actions";
import { signOutAdmin } from "@/features/admin/sign-out-action";

type Notice = {
  message: string;
  status: "success" | "error";
} | null;

type Borrower = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  occupation: string | null;
  guarantor_name: string | null;
  guarantor_occupation: string | null;
  phone_number: string;
  guarantor_phone_number: string | null;
  address: string | null;
  guarantor_address: string | null;
  borrower_id_name: string | null;
  borrower_id_image_path: string | null;
  passport_path: string | null;
  guarantor_id_name: string | null;
  guarantor_id_image_path: string | null;
  guarantor_passport_path: string | null;
  marital_status: string;
  must_change_password: boolean | null;
  created_at: string;
  updated_at: string | null;
};

type LoanBorrower = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type Loan = {
  id: string;
  borrower_id: string;
  principal_amount: number;
  interest_amount: number;
  total_amount_due: number | null;
  outstanding_total_amount: number | null;
  repayment_status: string | null;
  issued_at: string;
  due_at: string;
  consent_form_signed: boolean | null;
  has_collateral: boolean | null;
  borrowers: LoanBorrower | LoanBorrower[] | null;
};

type AdminPageProps = {
  adminEmail: string;
  adminName: string;
  notice: Notice;
  borrowers: Borrower[];
  loans: Loan[];
  initialSection: "add-borrower" | "borrowers" | "loans";
  serviceRoleConfigured: boolean;
};

type DashboardSection = "add-borrower" | "borrowers" | "loans";

const dashboardSections: Array<{
  id: DashboardSection;
  label: string;
  description: string;
}> = [
  {
    id: "add-borrower",
    label: "Add Borrower",
    description: "Create a borrower account",
  },
  {
    id: "borrowers",
    label: "Borrowers",
    description: "View and edit borrowers",
  },
  {
    id: "loans",
    label: "Loans",
    description: "Issue and review loans",
  },
];

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(date);
}

function formatAmount(value: number | null) {
  if (typeof value !== "number") {
    return "Not set";
  }

  return value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getBorrowerFullName(borrower: Borrower) {
  return [borrower.first_name, borrower.middle_name, borrower.last_name]
    .filter(Boolean)
    .join(" ");
}

function getLoanBorrower(loan: Loan) {
  if (Array.isArray(loan.borrowers)) {
    return loan.borrowers[0] ?? null;
  }

  return loan.borrowers;
}

function getLoanBorrowerName(loan: Loan) {
  const borrower = getLoanBorrower(loan);

  if (!borrower) {
    return "Borrower unavailable";
  }

  return [borrower.first_name, borrower.last_name].filter(Boolean).join(" ");
}

function DesktopOnlyMessage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(145deg,#f4efe5_0%,#e3e8dd_48%,#f8f4ed_100%)] px-6 py-10 lg:hidden">
      <section className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-[0_24px_90px_rgba(40,52,44,0.16)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7a6859]">
          Desktop Only
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Open this dashboard on a desktop screen.
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          The admin workspace is intentionally limited to larger screens to keep
          the forms and records readable.
        </p>
      </section>
    </main>
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  useEffect(() => {
    if (!notice) {
      return;
    }

    if (notice.status === "success") {
      notify.success(notice.message);
      return;
    }

    notify.error(notice.message);
  }, [notice]);

  return null;
}

function ActionSpinner({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0">
      <span
        className={
          tone === "light"
            ? "absolute inset-0 animate-spin rounded-full border-2 border-white/35 border-t-white"
            : "absolute inset-0 animate-spin rounded-full border-2 border-[#26473d]/20 border-t-[#20352e]"
        }
      />
      <span
        className={
          tone === "light"
            ? "absolute inset-[4px] rounded-full bg-white/85"
            : "absolute inset-[4px] rounded-full bg-[#20352e]"
        }
      />
    </span>
  );
}

function PendingSubmitButton({
  idleLabel,
  pendingLabel,
  variant = "primary",
  className = "",
  disabled = false,
}: {
  idleLabel: string;
  pendingLabel: string;
  variant?: "primary" | "outline" | "danger";
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const tone = variant === "primary" ? "light" : "dark";
  const baseClasses =
    variant === "danger"
      ? "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      : variant === "outline"
        ? "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#20352e] bg-transparent px-5 text-sm font-semibold text-[#20352e] transition hover:bg-[#20352e] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        : "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#20352e] px-6 text-sm font-semibold text-white transition hover:bg-[#182923] disabled:cursor-not-allowed disabled:bg-slate-400";

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`${baseClasses} ${className}`.trim()}
    >
      {pending ? (
        <>
          <ActionSpinner tone={tone} />
          {pendingLabel}
        </>
      ) : (
        idleLabel
      )}
    </button>
  );
}

function SidebarButton({
  section,
  activeSection,
  onSelect,
}: {
  section: (typeof dashboardSections)[number];
  activeSection: DashboardSection;
  onSelect: (section: DashboardSection) => void;
}) {
  const isActive = activeSection === section.id;

  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={() => onSelect(section.id)}
      className={
        isActive
          ? "rounded-3xl border border-[#2b574b] bg-[#20352e] px-4 py-4 text-left text-white shadow-[0_16px_40px_rgba(32,53,46,0.24)]"
          : "rounded-3xl border border-[#dde4da] bg-[#f7f4ee] px-4 py-4 text-left text-slate-800 transition hover:border-[#c6d4cc] hover:bg-white"
      }
    >
      <p className="text-sm font-semibold tracking-tight">{section.label}</p>
      <p
        className={
          isActive
            ? "mt-1 text-xs leading-5 text-[#dbe6de]"
            : "mt-1 text-xs leading-5 text-slate-500"
        }
      >
        {section.description}
      </p>
    </button>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8c735f]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        {description}
      </p>
    </div>
  );
}

type AddBorrowerDraft = {
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  password: string;
  occupation: string;
  phone_number: string;
  marital_status: string;
  address: string;
  borrower_id_name: string;
  borrower_id_image: File | null;
  borrower_passport_image: File | null;
  guarantor_name: string;
  guarantor_occupation: string;
  guarantor_phone_number: string;
  guarantor_address: string;
  guarantor_id_name: string;
  guarantor_id_image: File | null;
  guarantor_passport_image: File | null;
};

type ToastState = {
  status: "success" | "error" | "info";
  message: string;
} | null;

type AddBorrowerField = keyof AddBorrowerDraft;
type AddBorrowerFieldErrors = Partial<Record<AddBorrowerField, string>>;

const initialAddBorrowerDraft: AddBorrowerDraft = {
  first_name: "",
  middle_name: "",
  last_name: "",
  email: "",
  password: "",
  occupation: "",
  phone_number: "",
  marital_status: "",
  address: "",
  borrower_id_name: "",
  borrower_id_image: null,
  borrower_passport_image: null,
  guarantor_name: "",
  guarantor_occupation: "",
  guarantor_phone_number: "",
  guarantor_address: "",
  guarantor_id_name: "",
  guarantor_id_image: null,
  guarantor_passport_image: null,
};

function buildBorrowerDraftFormData(draft: AddBorrowerDraft) {
  const formData = new FormData();

  formData.set("first_name", draft.first_name);
  formData.set("middle_name", draft.middle_name);
  formData.set("last_name", draft.last_name);
  formData.set("email", draft.email);
  formData.set("password", draft.password);
  formData.set("occupation", draft.occupation);
  formData.set("phone_number", draft.phone_number);
  formData.set("marital_status", draft.marital_status);
  formData.set("address", draft.address);
  formData.set("borrower_id_name", draft.borrower_id_name);
  formData.set("guarantor_name", draft.guarantor_name);
  formData.set("guarantor_occupation", draft.guarantor_occupation);
  formData.set("guarantor_phone_number", draft.guarantor_phone_number);
  formData.set("guarantor_address", draft.guarantor_address);
  formData.set("guarantor_id_name", draft.guarantor_id_name);

  if (draft.borrower_id_image) {
    formData.set("borrower_id_image", draft.borrower_id_image);
  }

  if (draft.borrower_passport_image) {
    formData.set("borrower_passport_image", draft.borrower_passport_image);
  }

  if (draft.guarantor_id_image) {
    formData.set("guarantor_id_image", draft.guarantor_id_image);
  }

  if (draft.guarantor_passport_image) {
    formData.set("guarantor_passport_image", draft.guarantor_passport_image);
  }

  return formData;
}

function AddBorrowerToast({ toast }: { toast: ToastState }) {
  useEffect(() => {
    if (!toast) {
      return;
    }

    if (toast.status === "success") {
      notify.success(toast.message);
      return;
    }

    if (toast.status === "info") {
      notify(toast.message);
      return;
    }

    notify.error(toast.message);
  }, [toast]);

  return null;
}

function formatDraftLabel(value: string) {
  return value.trim() ? value : "Not provided";
}

const addBorrowerInputBaseClasses =
  "h-12 w-full rounded-2xl border bg-white px-4 text-sm text-slate-950 outline-none transition focus:ring-4";
const addBorrowerTextareaBaseClasses =
  "w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:ring-4";
const addBorrowerFileInputBaseClasses =
  "block w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-950 file:mr-4 file:rounded-xl file:border-0 file:bg-[#20352e] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white";

function getAddBorrowerFieldClasses(hasError: boolean) {
  return hasError
    ? `${addBorrowerInputBaseClasses} border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-100`
    : `${addBorrowerInputBaseClasses} border-[#d7d0c4] focus:border-[#2f5d50] focus:ring-[#2f5d50]/10`;
}

function getAddBorrowerTextareaClasses(hasError: boolean) {
  return hasError
    ? `${addBorrowerTextareaBaseClasses} border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-100`
    : `${addBorrowerTextareaBaseClasses} border-[#d7d0c4] focus:border-[#2f5d50] focus:ring-[#2f5d50]/10`;
}

function getAddBorrowerFileInputClasses(hasError: boolean) {
  return hasError
    ? `${addBorrowerFileInputBaseClasses} border-red-300 bg-red-50`
    : `${addBorrowerFileInputBaseClasses} border-[#d7d0c4]`;
}

function validateAddBorrowerDraft(draft: AddBorrowerDraft) {
  const errors: AddBorrowerFieldErrors = {};

  const requireField = (field: AddBorrowerField, message: string) => {
    const value = draft[field];

    if (typeof value === "string" && !value.trim()) {
      errors[field] = message;
    }
  };

  requireField("first_name", "First name is required.");
  requireField("last_name", "Last name is required.");
  requireField("email", "Email is required.");
  requireField("password", "Temporary password is required.");
  requireField("phone_number", "Phone number is required.");
  requireField("marital_status", "Marital status is required.");

  if (
    draft.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())
  ) {
    errors.email = "Enter a valid email address.";
  }

  if (
    draft.phone_number.trim() &&
    draft.guarantor_phone_number.trim() &&
    draft.phone_number.trim() === draft.guarantor_phone_number.trim()
  ) {
    errors.phone_number = "Borrower and guarantor cannot share one phone number.";
    errors.guarantor_phone_number =
      "Borrower and guarantor cannot share one phone number.";
  }

  if (
    (draft.borrower_id_name.trim() && !draft.borrower_id_image) ||
    (!draft.borrower_id_name.trim() && draft.borrower_id_image)
  ) {
    errors.borrower_id_name = "Add both the borrower ID type and image.";
    errors.borrower_id_image = "Add both the borrower ID type and image.";
  }

  if (
    (draft.guarantor_id_name.trim() && !draft.guarantor_id_image) ||
    (!draft.guarantor_id_name.trim() && draft.guarantor_id_image)
  ) {
    errors.guarantor_id_name = "Add both the guarantor ID type and image.";
    errors.guarantor_id_image = "Add both the guarantor ID type and image.";
  }

  if (Object.keys(errors).length === 0) {
    return {
      errors,
      message: null,
    };
  }

  const hasMissingRequiredField = [
    "first_name",
    "last_name",
    "email",
    "password",
    "phone_number",
    "marital_status",
  ].some((field) => Boolean(errors[field as AddBorrowerField]));

  if (hasMissingRequiredField) {
    return {
      errors,
      message: "Fill the highlighted required fields before continuing.",
    };
  }

  return {
    errors,
    message:
      errors.email ||
      errors.phone_number ||
      errors.borrower_id_name ||
      errors.guarantor_id_name ||
      "Review the highlighted fields before continuing.",
  };
}

function getRelatedAddBorrowerFields(field: AddBorrowerField): AddBorrowerField[] {
  switch (field) {
    case "borrower_id_name":
    case "borrower_id_image":
      return ["borrower_id_name", "borrower_id_image"];
    case "guarantor_id_name":
    case "guarantor_id_image":
      return ["guarantor_id_name", "guarantor_id_image"];
    case "phone_number":
    case "guarantor_phone_number":
      return ["phone_number", "guarantor_phone_number"];
    default:
      return [field];
  }
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read the selected image."));
    reader.readAsDataURL(file);
  });
}

async function downloadBorrowerDraftPdf(draft: AddBorrowerDraft) {
  const pdf = new jsPDF({
    unit: "pt",
    format: "a4",
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  const footerSpace = 34;
  const gutter = 14;
  const cardPadding = 14;
  const chipGap = 10;
  const borrowerAccent = [32, 53, 46] as const;
  const borrowerSoft = [242, 247, 243] as const;
  const guarantorAccent = [70, 92, 82] as const;
  const guarantorSoft = [245, 249, 246] as const;
  const ink = [26, 34, 31] as const;
  const muted = [107, 114, 128] as const;
  const line = [219, 223, 218] as const;
  const softLine = [228, 232, 226] as const;
  let cursorY = margin;

  type FieldItem = {
    label: string;
    value: string;
    span?: 1 | 2;
  };

  type PreparedImage = {
    label: string;
    fileName: string;
    helperText: string;
    dataUrl: string | null;
    format: "PNG" | "JPEG" | null;
    width: number;
    height: number;
  };

  const setTextColor = (color: readonly [number, number, number]) => {
    pdf.setTextColor(color[0], color[1], color[2]);
  };

  const setFillColor = (color: readonly [number, number, number]) => {
    pdf.setFillColor(color[0], color[1], color[2]);
  };

  const setDrawColor = (color: readonly [number, number, number]) => {
    pdf.setDrawColor(color[0], color[1], color[2]);
  };

  const getLines = (
    text: string,
    width: number,
    fontSize: number,
    style: "normal" | "bold" = "normal",
  ) => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(fontSize);
    return pdf.splitTextToSize(text, width) as string[];
  };

  const measureLinesHeight = (
    text: string,
    width: number,
    fontSize: number,
    lineHeight: number,
    style: "normal" | "bold" = "normal",
  ) => getLines(text, width, fontSize, style).length * lineHeight;

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY + requiredHeight <= pageHeight - margin - footerSpace) {
      return;
    }

    pdf.addPage();
    cursorY = margin;
  };

  const drawWrappedText = ({
    text,
    x,
    y,
    width,
    fontSize,
    lineHeight,
    style = "normal",
    color = ink,
  }: {
    text: string;
    x: number;
    y: number;
    width: number;
    fontSize: number;
    lineHeight: number;
    style?: "normal" | "bold";
    color?: readonly [number, number, number];
  }) => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(fontSize);
    setTextColor(color);
    const lines = pdf.splitTextToSize(text, width) as string[];
    pdf.text(lines, x, y);
    return lines.length * lineHeight;
  };

  const drawHeader = () => {
    const fullName = [draft.first_name, draft.middle_name, draft.last_name]
      .filter(Boolean)
      .join(" ");
    const generatedOn = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());

    setFillColor(borrowerAccent);
    pdf.roundedRect(margin, cursorY, contentWidth, 96, 24, 24, "F");

    setFillColor([255, 255, 255]);
    pdf.circle(margin + 24, cursorY + 24, 10, "F");

    drawWrappedText({
      text: fullName || "Borrower details",
      x: margin + 48,
      y: cursorY + 30,
      width: 280,
      fontSize: 22,
      lineHeight: 24,
      style: "bold",
      color: [255, 255, 255],
    });
    drawWrappedText({
      text:
        "Prepared for admin verification. Review, download, and share the completed copy with the borrower if needed.",
      x: margin + 48,
      y: cursorY + 54,
      width: 300,
      fontSize: 10,
      lineHeight: 13,
      color: [232, 238, 235],
    });
    drawWrappedText({
      text: "Generated On",
      x: pageWidth - margin - 148,
      y: cursorY + 26,
      width: 112,
      fontSize: 8,
      lineHeight: 10,
      style: "bold",
      color: [210, 221, 216],
    });
    drawWrappedText({
      text: generatedOn,
      x: pageWidth - margin - 148,
      y: cursorY + 44,
      width: 112,
      fontSize: 11,
      lineHeight: 13,
      style: "bold",
      color: [255, 255, 255],
    });
    drawWrappedText({
      text: fullName || "Borrower name not provided",
      x: pageWidth - margin - 148,
      y: cursorY + 71,
      width: 112,
      fontSize: 10,
      lineHeight: 12,
      color: [235, 241, 238],
    });

    cursorY += 112;

    const chipWidth = (contentWidth - chipGap * 2) / 3;
    const chips = [
      {
        label: "Borrower Phone",
        value: formatDraftLabel(draft.phone_number),
      },
      {
        label: "Guarantor Phone",
        value: formatDraftLabel(draft.guarantor_phone_number),
      },
      {
        label: "Marital Status",
        value: formatDraftLabel(draft.marital_status),
      },
    ];

    chips.forEach((chip, index) => {
      const x = margin + index * (chipWidth + chipGap);

      setFillColor([249, 247, 242]);
      setDrawColor(line);
      pdf.roundedRect(x, cursorY, chipWidth, 52, 18, 18, "FD");

      drawWrappedText({
        text: chip.label.toUpperCase(),
        x: x + 14,
        y: cursorY + 18,
        width: chipWidth - 28,
        fontSize: 8,
        lineHeight: 9,
        style: "bold",
        color: muted,
      });
      drawWrappedText({
        text: chip.value,
        x: x + 14,
        y: cursorY + 36,
        width: chipWidth - 28,
        fontSize: 12,
        lineHeight: 14,
        style: "bold",
      });
    });

    cursorY += 70;
  };

  const drawSectionHeader = (
    title: string,
    description: string,
    accent: readonly [number, number, number],
    soft: readonly [number, number, number],
  ) => {
    ensureSpace(70);

    setFillColor(soft);
    setDrawColor(softLine);
    pdf.roundedRect(margin, cursorY, contentWidth, 54, 20, 20, "FD");

    setFillColor(accent);
    pdf.roundedRect(margin + 14, cursorY + 11, 8, 32, 4, 4, "F");

    drawWrappedText({
      text: title,
      x: margin + 34,
      y: cursorY + 23,
      width: contentWidth - 48,
      fontSize: 16,
      lineHeight: 18,
      style: "bold",
    });
    drawWrappedText({
      text: description,
      x: margin + 34,
      y: cursorY + 40,
      width: contentWidth - 48,
      fontSize: 9,
      lineHeight: 11,
      color: muted,
    });

    cursorY += 68;
  };

  const measureFieldCardHeight = (label: string, value: string, width: number) => {
    const innerWidth = width - cardPadding * 2;
    const labelHeight = measureLinesHeight(
      label.toUpperCase(),
      innerWidth,
      8,
      9,
      "bold",
    );
    const valueHeight = measureLinesHeight(value, innerWidth, 12, 15);

    return Math.max(74, 16 + labelHeight + 8 + valueHeight + 16);
  };

  const drawFieldCard = ({
    x,
    y,
    width,
    height,
    label,
    value,
    soft,
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    value: string;
    soft: readonly [number, number, number];
  }) => {
    setFillColor(soft);
    setDrawColor(softLine);
    pdf.roundedRect(x, y, width, height, 18, 18, "FD");

    drawWrappedText({
      text: label.toUpperCase(),
      x: x + cardPadding,
      y: y + 18,
      width: width - cardPadding * 2,
      fontSize: 8,
      lineHeight: 9,
      style: "bold",
      color: muted,
    });
    drawWrappedText({
      text: value,
      x: x + cardPadding,
      y: y + 38,
      width: width - cardPadding * 2,
      fontSize: 12,
      lineHeight: 15,
      style: "bold",
    });
  };

  const drawFieldGrid = (
    fields: FieldItem[],
    soft: readonly [number, number, number],
  ) => {
    const columnWidth = (contentWidth - gutter) / 2;
    let index = 0;

    while (index < fields.length) {
      const currentField = fields[index]!;

      if (currentField.span === 2) {
        const fullHeight = measureFieldCardHeight(
          currentField.label,
          currentField.value,
          contentWidth,
        );

        ensureSpace(fullHeight);
        drawFieldCard({
          x: margin,
          y: cursorY,
          width: contentWidth,
          height: fullHeight,
          label: currentField.label,
          value: currentField.value,
          soft,
        });
        cursorY += fullHeight + gutter;
        index += 1;
        continue;
      }

      const nextField =
        fields[index + 1] && fields[index + 1]?.span !== 2
          ? fields[index + 1]
          : null;
      const leftHeight = measureFieldCardHeight(
        currentField.label,
        currentField.value,
        columnWidth,
      );
      const rightHeight = nextField
        ? measureFieldCardHeight(nextField.label, nextField.value, columnWidth)
        : 0;
      const rowHeight = Math.max(leftHeight, rightHeight);

      ensureSpace(rowHeight);

      drawFieldCard({
        x: margin,
        y: cursorY,
        width: columnWidth,
        height: rowHeight,
        label: currentField.label,
        value: currentField.value,
        soft,
      });

      if (nextField) {
        drawFieldCard({
          x: margin + columnWidth + gutter,
          y: cursorY,
          width: columnWidth,
          height: rowHeight,
          label: nextField.label,
          value: nextField.value,
          soft,
        });
      }

      cursorY += rowHeight + gutter;
      index += nextField ? 2 : 1;
    }
  };

  const prepareImage = async (
    label: string,
    file: File | null,
  ): Promise<PreparedImage> => {
    if (!file) {
      return {
        label,
        fileName: "No image attached",
        helperText: "No file was selected for this document.",
        dataUrl: null,
        format: null,
        width: 0,
        height: 0,
      };
    }

    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      return {
        label,
        fileName: file.name,
        helperText: "Preview unavailable for this file type.",
        dataUrl: null,
        format: null,
        width: 0,
        height: 0,
      };
    }

    const dataUrl = await fileToDataUrl(file);
    const properties = pdf.getImageProperties(dataUrl);

    return {
      label,
      fileName: file.name,
      helperText: "Attached image preview",
      dataUrl,
      format: file.type === "image/png" ? "PNG" : "JPEG",
      width: Number(properties.width) || 0,
      height: Number(properties.height) || 0,
    };
  };

  const drawImageCard = ({
    image,
    x,
    y,
    width,
    height,
    soft,
    accent,
  }: {
    image: PreparedImage;
    x: number;
    y: number;
    width: number;
    height: number;
    soft: readonly [number, number, number];
    accent: readonly [number, number, number];
  }) => {
    setFillColor(soft);
    setDrawColor(softLine);
    pdf.roundedRect(x, y, width, height, 18, 18, "FD");

    drawWrappedText({
      text: image.label.toUpperCase(),
      x: x + cardPadding,
      y: y + 18,
      width: width - cardPadding * 2,
      fontSize: 8,
      lineHeight: 9,
      style: "bold",
      color: muted,
    });
    drawWrappedText({
      text: image.fileName,
      x: x + cardPadding,
      y: y + 36,
      width: width - cardPadding * 2,
      fontSize: 10,
      lineHeight: 12,
      style: "bold",
    });

    const frameX = x + cardPadding;
    const frameY = y + 52;
    const frameWidth = width - cardPadding * 2;
    const frameHeight = 124;

    setFillColor([255, 255, 255]);
    setDrawColor(accent);
    pdf.roundedRect(frameX, frameY, frameWidth, frameHeight, 14, 14, "FD");

    if (image.dataUrl && image.format && image.width > 0 && image.height > 0) {
      const scale = Math.min(
        (frameWidth - 16) / image.width,
        (frameHeight - 16) / image.height,
      );
      const imageWidth = image.width * scale;
      const imageHeight = image.height * scale;
      const imageX = frameX + (frameWidth - imageWidth) / 2;
      const imageY = frameY + (frameHeight - imageHeight) / 2;

      pdf.addImage(
        image.dataUrl,
        image.format,
        imageX,
        imageY,
        imageWidth,
        imageHeight,
      );
    } else {
      drawWrappedText({
        text: image.helperText,
        x: frameX + 14,
        y: frameY + 58,
        width: frameWidth - 28,
        fontSize: 10,
        lineHeight: 12,
        style: "bold",
        color: muted,
      });
    }

    drawWrappedText({
      text: image.helperText,
      x: x + cardPadding,
      y: y + height - 14,
      width: width - cardPadding * 2,
      fontSize: 9,
      lineHeight: 11,
      color: muted,
    });
  };

  const drawImageGrid = (
    images: PreparedImage[],
    soft: readonly [number, number, number],
    accent: readonly [number, number, number],
  ) => {
    const columnWidth = (contentWidth - gutter) / 2;
    const cardHeight = 208;

    for (let index = 0; index < images.length; index += 2) {
      ensureSpace(cardHeight);

      drawImageCard({
        image: images[index]!,
        x: margin,
        y: cursorY,
        width: columnWidth,
        height: cardHeight,
        soft,
        accent,
      });

      if (images[index + 1]) {
        drawImageCard({
          image: images[index + 1]!,
          x: margin + columnWidth + gutter,
          y: cursorY,
          width: columnWidth,
          height: cardHeight,
          soft,
          accent,
        });
      }

      cursorY += cardHeight + gutter;
    }
  };

  const borrowerImages = await Promise.all([
    prepareImage("Borrower ID Image", draft.borrower_id_image),
    prepareImage("Borrower Passport Image", draft.borrower_passport_image),
  ]);
  const guarantorImages = await Promise.all([
    prepareImage("Guarantor ID Image", draft.guarantor_id_image),
    prepareImage("Guarantor Passport Image", draft.guarantor_passport_image),
  ]);

  drawHeader();

  drawSectionHeader(
    "Borrower's Information",
    "Primary borrower details prepared for final verification.",
    borrowerAccent,
    borrowerSoft,
  );
  drawFieldGrid(
    [
      { label: "First name", value: formatDraftLabel(draft.first_name) },
      { label: "Middle name", value: formatDraftLabel(draft.middle_name) },
      { label: "Last name", value: formatDraftLabel(draft.last_name) },
      { label: "Email", value: formatDraftLabel(draft.email) },
      { label: "Temporary password", value: formatDraftLabel(draft.password) },
      { label: "Phone number", value: formatDraftLabel(draft.phone_number) },
      { label: "Occupation", value: formatDraftLabel(draft.occupation) },
      {
        label: "Marital status",
        value: formatDraftLabel(draft.marital_status),
      },
      { label: "Address", value: formatDraftLabel(draft.address), span: 2 },
      {
        label: "Borrower ID type",
        value: formatDraftLabel(draft.borrower_id_name),
        span: 2,
      },
    ],
    borrowerSoft,
  );
  drawImageGrid(borrowerImages, borrowerSoft, borrowerAccent);

  drawSectionHeader(
    "Guarantor's Information",
    "Supporting guarantor details and attached identity documents.",
    guarantorAccent,
    guarantorSoft,
  );
  drawFieldGrid(
    [
      {
        label: "Guarantor name",
        value: formatDraftLabel(draft.guarantor_name),
      },
      {
        label: "Guarantor occupation",
        value: formatDraftLabel(draft.guarantor_occupation),
      },
      {
        label: "Guarantor phone number",
        value: formatDraftLabel(draft.guarantor_phone_number),
      },
      {
        label: "Guarantor ID type",
        value: formatDraftLabel(draft.guarantor_id_name),
      },
      {
        label: "Guarantor address",
        value: formatDraftLabel(draft.guarantor_address),
        span: 2,
      },
    ],
    guarantorSoft,
  );
  drawImageGrid(guarantorImages, guarantorSoft, guarantorAccent);

  const totalPages = pdf.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    pdf.setPage(pageNumber);
    setDrawColor(line);
    pdf.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);
    drawWrappedText({
      text: "Confidential borrower registration document",
      x: margin,
      y: pageHeight - 14,
      width: 220,
      fontSize: 8,
      lineHeight: 9,
      color: muted,
    });
    drawWrappedText({
      text: `Page ${pageNumber} of ${totalPages}`,
      x: pageWidth - margin - 70,
      y: pageHeight - 14,
      width: 70,
      fontSize: 8,
      lineHeight: 9,
      style: "bold",
      color: muted,
    });
  }

  const safeName = [draft.first_name, draft.last_name]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");

  pdf.save(`${safeName || "borrower"}-registration-review.pdf`);
}

function AddBorrowerReview({
  draft,
  busyAction,
  isCompleted,
  onDownload,
  onFinish,
  onBack,
}: {
  draft: AddBorrowerDraft;
  busyAction: "validate" | "finish" | "download" | null;
  isCompleted: boolean;
  onDownload: () => void;
  onFinish: () => void;
  onBack: () => void;
}) {
  return (
    <section className="space-y-8">
      <SectionIntro
        eyebrow="Verify Information"
        title="Review before creating the borrower"
        description="This step does not write to the database yet. Download the filled information as a PDF if you want to send the registration copy to the borrower, then finish when everything looks correct."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[1.5rem] border border-[#e4ddd1] bg-white p-5">
          <h4 className="text-xl font-semibold text-slate-950">
            Borrower&apos;s Information
          </h4>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-slate-500">Full name</dt>
              <dd className="mt-1 text-slate-950">
                {[draft.first_name, draft.middle_name, draft.last_name]
                  .filter(Boolean)
                  .join(" ")}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Email</dt>
              <dd className="mt-1 text-slate-950">
                {formatDraftLabel(draft.email)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Phone</dt>
              <dd className="mt-1 text-slate-950">
                {formatDraftLabel(draft.phone_number)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Occupation</dt>
              <dd className="mt-1 text-slate-950">
                {formatDraftLabel(draft.occupation)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Marital status</dt>
              <dd className="mt-1 text-slate-950">
                {formatDraftLabel(draft.marital_status)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Address</dt>
              <dd className="mt-1 text-slate-950">
                {formatDraftLabel(draft.address)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Borrower ID type</dt>
              <dd className="mt-1 text-slate-950">
                {formatDraftLabel(draft.borrower_id_name)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Borrower ID image</dt>
              <dd className="mt-1 text-slate-950">
                {draft.borrower_id_image?.name ?? "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">
                Borrower passport image
              </dt>
              <dd className="mt-1 text-slate-950">
                {draft.borrower_passport_image?.name ?? "Not provided"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[1.5rem] border border-[#dbe4da] bg-[#f7faf6] p-5">
          <h4 className="text-xl font-semibold text-slate-950">
            Guarantor&apos;s Information
          </h4>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-slate-500">Guarantor name</dt>
              <dd className="mt-1 text-slate-950">
                {formatDraftLabel(draft.guarantor_name)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">
                Guarantor occupation
              </dt>
              <dd className="mt-1 text-slate-950">
                {formatDraftLabel(draft.guarantor_occupation)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Guarantor phone</dt>
              <dd className="mt-1 text-slate-950">
                {formatDraftLabel(draft.guarantor_phone_number)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Guarantor address</dt>
              <dd className="mt-1 text-slate-950">
                {formatDraftLabel(draft.guarantor_address)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Guarantor ID type</dt>
              <dd className="mt-1 text-slate-950">
                {formatDraftLabel(draft.guarantor_id_name)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Guarantor ID image</dt>
              <dd className="mt-1 text-slate-950">
                {draft.guarantor_id_image?.name ?? "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">
                Guarantor passport image
              </dt>
              <dd className="mt-1 text-slate-950">
                {draft.guarantor_passport_image?.name ?? "Not provided"}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onDownload}
          disabled={busyAction !== null}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#20352e] bg-white px-6 text-sm font-semibold text-[#20352e] transition hover:bg-[#20352e] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busyAction === "download" ? (
            <>
              <ActionSpinner tone="dark" />
              Preparing PDF...
            </>
          ) : (
            "Download information"
          )}
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={busyAction !== null || isCompleted}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#20352e] px-6 text-sm font-semibold text-white transition hover:bg-[#182923] disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {busyAction === "finish"
            ? (
                <>
                  <ActionSpinner />
                  Finishing...
                </>
              )
            : isCompleted
              ? "Information finished"
              : "Finish information"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={busyAction !== null}
          className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#d4d0c7] bg-[#f7f4ee] px-6 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Back to edit
        </button>
      </div>
    </section>
  );
}

function AddBorrowerPanel({
  serviceRoleConfigured,
}: {
  serviceRoleConfigured: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<AddBorrowerDraft>(initialAddBorrowerDraft);
  const [fieldErrors, setFieldErrors] = useState<AddBorrowerFieldErrors>({});
  const [toast, setToast] = useState<ToastState>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);
  const [busyAction, setBusyAction] = useState<
    "validate" | "finish" | "download" | null
  >(null);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 4500);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const setTextField = (field: keyof AddBorrowerDraft, value: string) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
    setFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };

      for (const relatedField of getRelatedAddBorrowerFields(field)) {
        delete nextErrors[relatedField];
      }

      return nextErrors;
    });
  };

  const setFileField = (field: keyof AddBorrowerDraft, file: File | null) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: file,
    }));
    setFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };

      for (const relatedField of getRelatedAddBorrowerFields(field)) {
        delete nextErrors[relatedField];
      }

      return nextErrors;
    });
  };

  const handleDraftFieldChange = (event: FormEvent<HTMLFormElement>) => {
    const target = event.target;

    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      if (target instanceof HTMLInputElement && target.type === "file") {
        return;
      }

      const fieldName = target.name as keyof AddBorrowerDraft;

      if (!(fieldName in initialAddBorrowerDraft)) {
        return;
      }

      setTextField(fieldName, target.value);
    }
  };

  const runDraftAction = async (
    action: (formData: FormData) => Promise<BorrowerDraftActionResult>,
  ) => {
    const result = await action(buildBorrowerDraftFormData(draft));
    setToast({
      status: result.status === "success" ? "success" : "error",
      message: result.message,
    });
    return result;
  };

  const handleValidateDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!serviceRoleConfigured) {
      setToast({
        status: "error",
        message:
          "Borrower account creation needs SUPABASE_SERVICE_ROLE_KEY on the server.",
      });
      return;
    }

    const clientValidation = validateAddBorrowerDraft(draft);

    if (clientValidation.message) {
      setFieldErrors(clientValidation.errors);
      setToast({
        status: "error",
        message: clientValidation.message,
      });
      return;
    }

    setFieldErrors({});

    setBusyAction("validate");

    try {
      const result = await runDraftAction(validateBorrowerDraft);

      if (result.status === "success") {
        setIsReviewing(true);
        setIsCompleted(false);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleFinishDraft = async () => {
    setBusyAction("finish");

    try {
      const result = await runDraftAction(finalizeBorrowerDraft);

      if (result.status === "success") {
        setDraft(initialAddBorrowerDraft);
        setFieldErrors({});
        setIsReviewing(false);
        setIsCompleted(false);
        setFormResetKey((currentKey) => currentKey + 1);
        setToast({
          status: "success",
          message:
            "Borrower registered successfully. The form has been cleared for the next registration.",
        });
        router.refresh();
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadPdf = async () => {
    setBusyAction("download");

    try {
      await downloadBorrowerDraftPdf(draft);
      setToast({
        status: "info",
        message: "PDF download started.",
      });
    } catch {
      setToast({
        status: "error",
        message: "Unable to generate the PDF right now.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="space-y-8">
      <SectionIntro
        eyebrow="Borrower Setup"
        title="Add a borrower to the platform"
        description="Fill the form, validate it without losing the data, review everything on the next step, then finish the registration only when you are satisfied."
      />

      <AddBorrowerToast toast={toast} />

      {!serviceRoleConfigured ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
          `SUPABASE_SERVICE_ROLE_KEY` is missing, so borrower account creation
          is currently disabled.
        </div>
      ) : null}

      {isReviewing ? (
        <AddBorrowerReview
          draft={draft}
          busyAction={busyAction}
          isCompleted={isCompleted}
          onDownload={handleDownloadPdf}
          onFinish={handleFinishDraft}
          onBack={() => setIsReviewing(false)}
        />
      ) : null}

      <form
        key={formResetKey}
        onSubmit={handleValidateDraft}
        onChange={handleDraftFieldChange}
        noValidate
        className={isReviewing ? "hidden" : "space-y-6"}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="xl:col-span-2 rounded-[1.75rem] border border-[#e2dbcf] bg-[#fcfbf7] px-5 py-5">
            <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
              Borrower&apos;s Information
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Complete the borrower details in this upper section.
            </p>
          </div>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              First name
            </span>
            <input
              name="first_name"
              required
              className={getAddBorrowerFieldClasses(Boolean(fieldErrors.first_name))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Middle name
            </span>
            <input
              name="middle_name"
              className={getAddBorrowerFieldClasses(Boolean(fieldErrors.middle_name))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Last name
            </span>
            <input
              name="last_name"
              required
              className={getAddBorrowerFieldClasses(Boolean(fieldErrors.last_name))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              name="email"
              type="email"
              required
              className={getAddBorrowerFieldClasses(Boolean(fieldErrors.email))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Temporary password
            </span>
            <input
              name="password"
              type="text"
              required
              className={getAddBorrowerFieldClasses(Boolean(fieldErrors.password))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Phone number
            </span>
            <input
              name="phone_number"
              required
              className={getAddBorrowerFieldClasses(Boolean(fieldErrors.phone_number))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Occupation
            </span>
            <input
              name="occupation"
              className={getAddBorrowerFieldClasses(Boolean(fieldErrors.occupation))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Marital status
            </span>
            <select
              name="marital_status"
              required
              defaultValue=""
              className={getAddBorrowerFieldClasses(Boolean(fieldErrors.marital_status))}
            >
              <option value="" disabled>
                Select status
              </option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
            </select>
          </label>
          <label className="space-y-2 xl:col-span-2">
            <span className="text-sm font-medium text-slate-700">Address</span>
            <textarea
              name="address"
              rows={3}
              className={getAddBorrowerTextareaClasses(Boolean(fieldErrors.address))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Borrower ID Type
            </span>
            <input
              name="borrower_id_name"
              placeholder="National ID, passport, driver's licence"
              className={getAddBorrowerFieldClasses(Boolean(fieldErrors.borrower_id_name))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Borrower valid ID image
            </span>
            <input
              name="borrower_id_image"
              type="file"
              accept="image/*"
              onChange={(event) =>
                setFileField(
                  "borrower_id_image",
                  event.target.files?.[0] ?? null,
                )
              }
              className={getAddBorrowerFileInputClasses(Boolean(fieldErrors.borrower_id_image))}
            />
            <p className="text-xs text-slate-500">
              Selected file: {draft.borrower_id_image?.name ?? "None"}
            </p>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Borrower passport image
            </span>
            <input
              name="borrower_passport_image"
              type="file"
              accept="image/*"
              onChange={(event) =>
                setFileField(
                  "borrower_passport_image",
                  event.target.files?.[0] ?? null,
                )
              }
              className={getAddBorrowerFileInputClasses(Boolean(fieldErrors.borrower_passport_image))}
            />
            <p className="text-xs text-slate-500">
              Selected file: {draft.borrower_passport_image?.name ?? "None"}
            </p>
          </label>
          <div className="xl:col-span-2 rounded-[1.75rem] border border-[#d8e1d6] bg-[#f5f8f3] px-5 py-5">
            <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
              Guarantor&apos;s Information
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Complete the guarantor details in this lower section.
            </p>
          </div>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Guarantor name
            </span>
            <input
              name="guarantor_name"
              className={getAddBorrowerFieldClasses(Boolean(fieldErrors.guarantor_name))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Guarantor occupation
            </span>
            <input
              name="guarantor_occupation"
              className={getAddBorrowerFieldClasses(Boolean(fieldErrors.guarantor_occupation))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Guarantor phone
            </span>
            <input
              name="guarantor_phone_number"
              className={getAddBorrowerFieldClasses(Boolean(fieldErrors.guarantor_phone_number))}
            />
          </label>
          <label className="space-y-2 xl:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Guarantor address
            </span>
            <textarea
              name="guarantor_address"
              rows={3}
              className={getAddBorrowerTextareaClasses(Boolean(fieldErrors.guarantor_address))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Guarantor ID Type
            </span>
            <input
              name="guarantor_id_name"
              placeholder="National ID, passport, driver's licence"
              className={getAddBorrowerFieldClasses(Boolean(fieldErrors.guarantor_id_name))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Guarantor ID image
            </span>
            <input
              name="guarantor_id_image"
              type="file"
              accept="image/*"
              onChange={(event) =>
                setFileField(
                  "guarantor_id_image",
                  event.target.files?.[0] ?? null,
                )
              }
              className={getAddBorrowerFileInputClasses(Boolean(fieldErrors.guarantor_id_image))}
            />
            <p className="text-xs text-slate-500">
              Selected file: {draft.guarantor_id_image?.name ?? "None"}
            </p>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Guarantor passport image
            </span>
            <input
              name="guarantor_passport_image"
              type="file"
              accept="image/*"
              onChange={(event) =>
                setFileField(
                  "guarantor_passport_image",
                  event.target.files?.[0] ?? null,
                )
              }
              className={getAddBorrowerFileInputClasses(Boolean(fieldErrors.guarantor_passport_image))}
            />
            <p className="text-xs text-slate-500">
              Selected file: {draft.guarantor_passport_image?.name ?? "None"}
            </p>
          </label>
        </div>

        <button
          type="submit"
          disabled={!serviceRoleConfigured || busyAction !== null}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#20352e] px-6 text-sm font-semibold text-white transition hover:bg-[#182923] disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {busyAction === "validate" ? (
            <>
              <ActionSpinner />
              Checking information...
            </>
          ) : (
            "Create borrower"
          )}
        </button>
      </form>
    </section>
  );
}

function BorrowersPanel({ borrowers }: { borrowers: Borrower[] }) {
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string | null>(
    null,
  );
  const selectedBorrower = borrowers.find(
    (borrower) => borrower.id === selectedBorrowerId,
  );

  return (
    <section className="space-y-8">
      <SectionIntro
        eyebrow="Borrower Records"
        title="Borrowers"
        description={
          selectedBorrower
            ? "View one borrower at a time with a clean, focused record screen."
            : "Open a borrower from the list to view the full record in a focused screen."
        }
      />

      {borrowers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#cfcec6] bg-[#f7f4ee] px-6 py-10 text-sm text-slate-600">
          No borrowers have been created yet.
        </div>
      ) : selectedBorrower ? (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setSelectedBorrowerId(null)}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#d4d0c7] bg-[#f7f4ee] px-5 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            Back to borrower list
          </button>

          <section className="rounded-[2rem] border border-[#e2ddd3] bg-white/95 p-6 shadow-[0_18px_50px_rgba(55,64,58,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ece5d9] pb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8c735f]">
                  Borrower Record
                </p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {getBorrowerFullName(selectedBorrower)}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {selectedBorrower.email}
                </p>
              </div>
              <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#e7e1d7] bg-[#fcfbf8] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c735f]">
                    Date Joined
                  </p>
                  <p className="mt-2 font-medium text-slate-900">
                    {formatDate(selectedBorrower.created_at)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#e7e1d7] bg-[#fcfbf8] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c735f]">
                    Last Updated
                  </p>
                  <p className="mt-2 font-medium text-slate-900">
                    {formatDate(selectedBorrower.updated_at ?? selectedBorrower.created_at)}
                  </p>
                </div>
              </div>
            </div>

            <form action={updateBorrower} className="mt-6 space-y-6">
              <input
                type="hidden"
                name="borrower_id"
                value={selectedBorrower.id}
              />

              <div className="rounded-[1.5rem] border border-[#e7e1d7] bg-[#fcfbf8] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c735f]">
                  Borrower login email
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {selectedBorrower.email}
                </p>
              </div>

              <div>
                <h4 className="text-xl font-semibold text-slate-950">
                  Borrower&apos;s Information
                </h4>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      First name
                    </span>
                    <input
                      name="first_name"
                      required
                      defaultValue={selectedBorrower.first_name}
                      className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Middle name
                    </span>
                    <input
                      name="middle_name"
                      defaultValue={selectedBorrower.middle_name ?? ""}
                      className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Last name
                    </span>
                    <input
                      name="last_name"
                      required
                      defaultValue={selectedBorrower.last_name}
                      className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Occupation
                    </span>
                    <input
                      name="occupation"
                      defaultValue={selectedBorrower.occupation ?? ""}
                      className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Phone number
                    </span>
                    <input
                      name="phone_number"
                      required
                      defaultValue={selectedBorrower.phone_number}
                      className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Marital status
                    </span>
                    <select
                      name="marital_status"
                      required
                      defaultValue={selectedBorrower.marital_status}
                      className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
                    >
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Borrower ID Type
                    </span>
                    <input
                      name="borrower_id_name"
                      defaultValue={selectedBorrower.borrower_id_name ?? ""}
                      className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Borrower valid ID image
                    </span>
                    <input
                      name="borrower_id_image"
                      type="file"
                      accept="image/*"
                      className="block w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 py-3 text-sm text-slate-950 file:mr-4 file:rounded-xl file:border-0 file:bg-[#20352e] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                    />
                    <p className="text-xs text-slate-500">
                      Current file: {selectedBorrower.borrower_id_image_path ?? "None"}
                    </p>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Borrower passport image
                    </span>
                    <input
                      name="borrower_passport_image"
                      type="file"
                      accept="image/*"
                      className="block w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 py-3 text-sm text-slate-950 file:mr-4 file:rounded-xl file:border-0 file:bg-[#20352e] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                    />
                    <p className="text-xs text-slate-500">
                      Current file: {selectedBorrower.passport_path ?? "None"}
                    </p>
                  </label>
                  <label className="space-y-2 xl:col-span-2">
                    <span className="text-sm font-medium text-slate-700">
                      Address
                    </span>
                    <textarea
                      name="address"
                      rows={3}
                      defaultValue={selectedBorrower.address ?? ""}
                      className="w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
                    />
                  </label>
                </div>
              </div>

              <div>
                <h4 className="text-xl font-semibold text-slate-950">
                  Guarantor&apos;s Information
                </h4>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Guarantor name
                    </span>
                    <input
                      name="guarantor_name"
                      defaultValue={selectedBorrower.guarantor_name ?? ""}
                      className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Guarantor occupation
                    </span>
                    <input
                      name="guarantor_occupation"
                      defaultValue={selectedBorrower.guarantor_occupation ?? ""}
                      className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Guarantor phone
                    </span>
                    <input
                      name="guarantor_phone_number"
                      defaultValue={selectedBorrower.guarantor_phone_number ?? ""}
                      className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Guarantor ID Type
                    </span>
                    <input
                      name="guarantor_id_name"
                      defaultValue={selectedBorrower.guarantor_id_name ?? ""}
                      className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Guarantor ID image
                    </span>
                    <input
                      name="guarantor_id_image"
                      type="file"
                      accept="image/*"
                      className="block w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 py-3 text-sm text-slate-950 file:mr-4 file:rounded-xl file:border-0 file:bg-[#20352e] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                    />
                    <p className="text-xs text-slate-500">
                      Current file: {selectedBorrower.guarantor_id_image_path ?? "None"}
                    </p>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">
                      Guarantor passport image
                    </span>
                    <input
                      name="guarantor_passport_image"
                      type="file"
                      accept="image/*"
                      className="block w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 py-3 text-sm text-slate-950 file:mr-4 file:rounded-xl file:border-0 file:bg-[#20352e] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                    />
                    <p className="text-xs text-slate-500">
                      Current file: {selectedBorrower.guarantor_passport_path ?? "None"}
                    </p>
                  </label>
                  <label className="space-y-2 xl:col-span-2">
                    <span className="text-sm font-medium text-slate-700">
                      Guarantor address
                    </span>
                    <textarea
                      name="guarantor_address"
                      rows={3}
                      defaultValue={selectedBorrower.guarantor_address ?? ""}
                      className="w-full rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <PendingSubmitButton
                  idleLabel="Save changes"
                  pendingLabel="Saving changes..."
                  className="h-11 px-5"
                />
              </div>
            </form>

            <form action={deleteBorrower} className="mt-4">
              <input
                type="hidden"
                name="borrower_id"
                value={selectedBorrower.id}
              />
              <PendingSubmitButton
                idleLabel="Delete borrower"
                pendingLabel="Deleting borrower..."
                variant="danger"
              />
            </form>
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,0.95fr)_minmax(0,1.45fr)_minmax(0,0.95fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_56px] gap-4 rounded-[1.75rem] border border-[#e6e0d4] bg-[#f8f4ed] px-5 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#8c735f]">
            <p>First Name</p>
            <p>Last Name</p>
            <p>Email</p>
            <p>Phone</p>
            <p>Date Joined</p>
            <p>Last Updated</p>
            <p className="text-right">View</p>
          </div>

          {borrowers.map((borrower) => (
            <button
              key={borrower.id}
              type="button"
              onClick={() => setSelectedBorrowerId(borrower.id)}
              className="w-full rounded-[2rem] border border-[#e2ddd3] bg-white/90 p-5 text-left shadow-[0_18px_50px_rgba(55,64,58,0.08)] transition hover:border-[#d2dbcf] hover:bg-white"
            >
              <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,0.95fr)_minmax(0,1.45fr)_minmax(0,0.95fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_56px] items-center gap-4 rounded-[1.5rem] border border-[#ebe4d9] bg-[#fcfbf8] px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {borrower.first_name}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {borrower.middle_name ?? "No middle name"}
                  </p>
                </div>
                <p className="truncate text-sm font-semibold text-slate-900">
                  {borrower.last_name}
                </p>
                <p className="truncate text-sm text-slate-600">
                  {borrower.email}
                </p>
                <p className="truncate text-sm text-slate-600">
                  {borrower.phone_number}
                </p>
                <p className="text-sm text-slate-600">
                  {formatDate(borrower.created_at)}
                </p>
                <p className="text-sm text-slate-600">
                  {formatDate(borrower.updated_at ?? borrower.created_at)}
                </p>
                <span className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d9dfd6] bg-white text-[#20352e] shadow-[0_10px_24px_rgba(38,59,48,0.08)]">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  </span>
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function LoansPanel({
  borrowers,
  loans,
}: {
  borrowers: Borrower[];
  loans: Loan[];
}) {
  return (
    <section className="space-y-8">
      <SectionIntro
        eyebrow="Loan Management"
        title="Loans"
        description="Create a new loan from this panel, then review the most recent loan records below."
      />

      <form action={createLoan} className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-2">
          <label className="space-y-2 xl:col-span-2">
            <span className="text-sm font-medium text-slate-700">Borrower</span>
            <select
              name="borrower_id"
              required
              defaultValue=""
              disabled={borrowers.length === 0}
              className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10 disabled:bg-slate-100"
            >
              <option value="" disabled>
                {borrowers.length === 0
                  ? "Create a borrower first"
                  : "Select a borrower"}
              </option>
              {borrowers.map((borrower) => (
                <option key={borrower.id} value={borrower.id}>
                  {getBorrowerFullName(borrower)} - {borrower.email}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Principal amount
            </span>
            <input
              name="principal_amount"
              type="number"
              min="0"
              step="0.01"
              required
              className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Interest amount
            </span>
            <input
              name="interest_amount"
              type="number"
              min="0"
              step="0.01"
              required
              className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Issued date
            </span>
            <input
              name="issued_at"
              type="date"
              required
              className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Due date</span>
            <input
              name="due_at"
              type="date"
              required
              className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
            />
          </label>
          <label className="space-y-2 xl:col-span-2">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea
              name="notes"
              rows={3}
              className="w-full rounded-2xl border border-[#d7d0c4] bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
            />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 py-3 text-sm text-slate-700">
            <input
              name="consent_form_signed"
              type="checkbox"
              className="h-4 w-4 rounded border-[#bfb6a8] text-[#20352e] focus:ring-[#2f5d50]/20"
            />
            Consent form signed
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[#d7d0c4] bg-[#fcfbf8] px-4 py-3 text-sm text-slate-700">
            <input
              name="has_collateral"
              type="checkbox"
              className="h-4 w-4 rounded border-[#bfb6a8] text-[#20352e] focus:ring-[#2f5d50]/20"
            />
            Loan has collateral
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Collateral name
            </span>
            <input
              name="collateral_name"
              className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Collateral image path
            </span>
            <input
              name="collateral_image_path"
              className="h-12 w-full rounded-2xl border border-[#d7d0c4] bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
            />
          </label>
          <label className="space-y-2 xl:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Collateral description
            </span>
            <textarea
              name="collateral_description"
              rows={3}
              className="w-full rounded-2xl border border-[#d7d0c4] bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
            />
          </label>
        </div>

        <PendingSubmitButton
          idleLabel="Issue loan"
          pendingLabel="Issuing loan..."
          disabled={borrowers.length === 0}
        />
      </form>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-xl font-semibold text-slate-950">Recent loans</h3>
          <p className="text-sm text-slate-500">{loans.length} shown</p>
        </div>

        {loans.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#cfcec6] bg-[#f7f4ee] px-6 py-10 text-sm text-slate-600">
            No loans have been issued yet.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {loans.map((loan) => {
              const borrower = getLoanBorrower(loan);

              return (
                <article
                  key={loan.id}
                  className="rounded-[2rem] border border-[#e2ddd3] bg-white/90 p-6 shadow-[0_18px_50px_rgba(55,64,58,0.08)]"
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8c735f]">
                    {loan.repayment_status ?? "Pending"}
                  </p>
                  <h4 className="mt-3 text-xl font-semibold text-slate-950">
                    {getLoanBorrowerName(loan)}
                  </h4>
                  <p className="mt-1 text-sm text-slate-500">
                    {borrower?.email ?? "No borrower email available"}
                  </p>

                  <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Principal
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-slate-900">
                        {formatAmount(loan.principal_amount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Interest
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-slate-900">
                        {formatAmount(loan.interest_amount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Total due
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-slate-900">
                        {formatAmount(loan.total_amount_due)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Outstanding
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-slate-900">
                        {formatAmount(loan.outstanding_total_amount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Issued
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-slate-900">
                        {formatDate(loan.issued_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Due
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-slate-900">
                        {formatDate(loan.due_at)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                    <span className="rounded-full bg-[#eef3ee] px-3 py-1.5">
                      {loan.consent_form_signed
                        ? "Consent signed"
                        : "No consent"}
                    </span>
                    <span className="rounded-full bg-[#f2eee8] px-3 py-1.5">
                      {loan.has_collateral
                        ? "Collateral attached"
                        : "No collateral"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function AdminPage({
  adminEmail,
  adminName,
  notice,
  borrowers,
  loans,
  initialSection,
  serviceRoleConfigured,
}: AdminPageProps) {
  const [activeSection, setActiveSection] =
    useState<DashboardSection>(initialSection);

  return (
    <>
      <DesktopOnlyMessage />

      <main className="hidden min-h-screen bg-[linear-gradient(145deg,#f0eadf_0%,#e4eadf_46%,#f7f3ec_100%)] p-6 text-slate-950 lg:block">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1600px] gap-6">
          <aside className="flex w-[300px] shrink-0 flex-col rounded-[2rem] border border-white/70 bg-[#f6f1e8]/90 p-6 shadow-[0_24px_90px_rgba(40,52,44,0.14)] backdrop-blur">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7a6859]">
                Admin Panel
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                Dashboard
              </h1>
              <div className="mt-6 rounded-3xl bg-white px-4 py-4">
                <p className="text-base font-semibold text-slate-950">
                  {adminName}
                </p>
                <p className="mt-1 text-sm text-slate-500">{adminEmail}</p>
              </div>
            </div>

            <nav className="mt-8 flex flex-col gap-3">
              {dashboardSections.map((section) => (
                <SidebarButton
                  key={section.id}
                  section={section}
                  activeSection={activeSection}
                  onSelect={setActiveSection}
                />
              ))}
            </nav>

            <div className="mt-auto rounded-3xl border border-[#dcd6ca] bg-white px-4 py-4 text-sm leading-6 text-slate-600">
              One function per panel. Choose an item on the left and the form or
              records open here without extra screens.
            </div>

            <form action={signOutAdmin} className="mt-4">
              <PendingSubmitButton
                idleLabel="Sign out"
                pendingLabel="Signing out..."
                variant="outline"
                className="w-full"
              />
            </form>
          </aside>

          <section className="flex-1 rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-[0_24px_90px_rgba(40,52,44,0.14)] backdrop-blur">
            <div className="space-y-8">
              <Toaster
                position="top-center"
                richColors
                expand
                toastOptions={{
                  duration: 4200,
                  classNames: {
                    toast:
                      "rounded-[1.35rem] border border-white/70 bg-white/95 shadow-[0_18px_60px_rgba(38,55,45,0.18)]",
                    title: "text-sm font-semibold",
                  },
                }}
              />
              <NoticeBanner notice={notice} />

              {activeSection === "add-borrower" ? (
                <AddBorrowerPanel
                  serviceRoleConfigured={serviceRoleConfigured}
                />
              ) : null}

              {activeSection === "borrowers" ? (
                <BorrowersPanel borrowers={borrowers} />
              ) : null}

              {activeSection === "loans" ? (
                <LoansPanel borrowers={borrowers} loans={loans} />
              ) : null}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
