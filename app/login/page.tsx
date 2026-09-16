import Link from "next/link";
import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const signup = sp.mode === "signup";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">
            L
          </span>
          <span className="text-xl font-bold tracking-tight text-slate-900">Lane</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">
            {signup ? "Create your account" : "Sign in to your board"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {signup ? "One board for every project." : "Pick up where your team left off."}
          </p>

          <form action={signup ? signUp : signIn} className="mt-5 space-y-3">
            {signup && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Name</span>
                <input name="name" required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Alex Rivera" />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Email</span>
              <input name="email" type="email" required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="you@work.com" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Password</span>
              <input name="password" type="password" required minLength={6}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••" />
            </label>

            {sp.error && <p className="text-sm text-rose-600">{sp.error}</p>}

            <button type="submit"
              className="w-full rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              {signup ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            {signup ? "Already have an account? " : "New here? "}
            <Link href={signup ? "/login" : "/login?mode=signup"}
              className="font-semibold text-indigo-600 hover:underline">
              {signup ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
