import type { Metadata } from "next";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Networkd — paid expert consultations",
  description:
    "Networkd is a paid networking platform where experts charge for consulting calls — booked, paid, and hosted in one streamlined flow.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-bold text-brand">
              Networkd
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/experts" className="hover:underline">
                Browse experts
              </Link>
              {session?.user ? (
                <>
                  <Link href="/dashboard" className="hover:underline">
                    Dashboard
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/" });
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/signin"
                  className="rounded bg-brand px-3 py-1 text-white hover:bg-brand-dark"
                >
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
