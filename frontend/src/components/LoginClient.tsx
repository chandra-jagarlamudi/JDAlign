"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Loader2 } from "lucide-react";

interface LoginClientProps {
  authEnabled: boolean;
}

export default function LoginClient({ authEnabled }: LoginClientProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!authEnabled || session) {
      router.push("/");
    }
  }, [session, router, authEnabled]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome to JDAlign</h1>
          <p className="text-slate-600">Please sign in to access the Agentic Resume Auditor</p>
        </div>

        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-all shadow-sm"
        >
          <img src="https://authjs.dev/img/providers/google.svg" className="h-5 w-5" alt="Google" />
          Sign in with Google
        </button>

        <div className="text-center">
          <p className="text-xs text-slate-400">
            Secure authentication powered by NextAuth.js
          </p>
        </div>
      </div>
    </div>
  );
}
