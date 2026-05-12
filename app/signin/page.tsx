import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-md rounded-lg border bg-white p-8 text-center">
      <h1 className="mb-2 text-2xl font-bold">Sign in to Networkd</h1>
      <p className="mb-6 text-sm text-slate-600">
        We use your Google account so we can place sessions on your calendar
        with a Meet link.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/onboarding" });
        }}
      >
        <button
          type="submit"
          className="w-full rounded-md bg-brand px-4 py-2 text-white hover:bg-brand-dark"
        >
          Continue with Google
        </button>
      </form>
    </div>
  );
}
