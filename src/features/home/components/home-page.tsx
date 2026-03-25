import { AdminLoginForm } from "./admin-login-form";

export function HomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#efe8dc_0%,#d8e1d3_48%,#f7f3ec_100%)] px-6 py-10 text-slate-950">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-6rem] h-64 w-64 rounded-full bg-white/50 blur-3xl" />
        <div className="absolute bottom-[-7rem] right-[-4rem] h-72 w-72 rounded-full bg-[#2f5d50]/18 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-40 w-40 -translate-x-1/2 rounded-full bg-[#b68256]/15 blur-3xl" />
      </div>

      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/60 bg-white/70 shadow-[0_30px_120px_rgba(40,52,44,0.18)] backdrop-blur md:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col justify-between bg-[#20352e] px-8 py-10 text-[#f6f1e8] sm:px-10 sm:py-12">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f6f1e8] text-sm font-semibold tracking-[0.24em] text-[#20352e]">
              SA
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[#c6d4cc]">
                Private Portal
              </p>
              <p className="mt-1 text-lg font-semibold">Secure Access</p>
            </div>
          </div>

          <div className="mt-16 space-y-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#c6d4cc]">
              Welcome Back
            </p>
            <h1 className="max-w-md text-4xl font-semibold leading-tight sm:text-5xl">
              Sign in to continue.
            </h1>
            <p className="max-w-md text-base leading-7 text-[#d8e1db]">
              A personal, private space for record keeping.
            </p>
          </div>

          <div className="mt-16 grid gap-4 text-sm text-[#d8e1db] sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[#c6d4cc]">
                Access
              </p>
              <p className="mt-2 text-base font-medium text-white">
                Email and password
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[#c6d4cc]">
                Session
              </p>
              <p className="mt-2 text-base font-medium text-white">
                Protected sign-in
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center bg-[#fcfaf6] px-6 py-8 sm:px-10 sm:py-12">
          <div className="w-full">
            <div className="mb-8">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#8c735f]">
                Login
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Enter your details
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Use your account credentials to access the dashboard.
              </p>
            </div>

            <AdminLoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
