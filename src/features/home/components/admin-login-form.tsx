"use client";

import { useState } from "react";
import { useActionState } from "react";

import {
  type AdminLoginState,
  loginAdmin,
} from "@/features/home/admin-login-action";

const initialAdminLoginState: AdminLoginState = {
  email: "",
  error: null,
};

export function AdminLoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(
    loginAdmin,
    initialAdminLoginState,
  );

  return (
    <form className="space-y-5" action={formAction}>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Email"
          defaultValue={state.email}
          className="h-13 w-full rounded-2xl border border-[#d8cfbf] bg-white px-4 text-base text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <label
            htmlFor="password"
            className="text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <button
            type="button"
            onClick={() => setShowPassword((currentValue) => !currentValue)}
            className="text-sm font-medium text-[#2f5d50] transition hover:text-[#20352e]"
          >
            {showPassword ? "Hide password" : "Show password"}
          </button>
        </div>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Enter your password"
          className="h-13 w-full rounded-2xl border border-[#d8cfbf] bg-white px-4 text-base text-slate-950 outline-none transition focus:border-[#2f5d50] focus:ring-4 focus:ring-[#2f5d50]/10"
        />
      </div>

      {state.error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-13 w-full items-center justify-center rounded-2xl bg-[#20352e] px-5 text-base font-semibold text-white transition hover:bg-[#182923] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Signing In..." : "Sign In"}
      </button>
    </form>
  );
}
