import Link from "next/link";
import { BrandMark, Panel, Shell, SiteFooter } from "@/components/Shell";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AboutPage() {
  return (
    <Shell>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/sign-in">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/sign-in"
            className="inline-flex h-10 items-center rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)]"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-16">
        <p className="text-sm font-semibold text-[var(--accent)]">About</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Speakeasy
        </h1>
        <Panel className="mt-8 space-y-4 p-6 text-base leading-relaxed text-[var(--muted)] sm:p-8">
          <p>
            Speakeasy is a practice studio for timed speaking and essays. Topics
            can be open or scoped to exams like UPSC, IELTS, CAT, and Bank PO.
          </p>
          <p>
            Scoring is evidence-based: empty answers score near zero, and
            feedback tracks clarity, structure, and substance, not participation
            trophies.
          </p>
          <p>
            Sign in to sync history and profile across devices. Guest browsing of
            the studio is disabled so your work lives on your account.
          </p>
        </Panel>
      </main>

      <SiteFooter />
    </Shell>
  );
}
