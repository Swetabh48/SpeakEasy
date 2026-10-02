import Link from "next/link";
import { BrandMark, Panel, Shell, SiteFooter } from "@/components/Shell";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function ContactPage() {
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
        <p className="text-sm font-semibold text-[var(--accent)]">Contact</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Get in touch
        </h1>
        <Panel className="mt-8 space-y-5 p-6 sm:p-8">
          <p className="text-base leading-relaxed text-[var(--muted)]">
            Questions, feedback, or partnership ideas? Drop a line.
          </p>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium text-[var(--muted)]">Email</p>
              <a
                href="mailto:hello@spkeasy.in"
                className="mt-1 inline-block font-semibold text-[var(--accent-deep)] hover:underline"
              >
                hello@spkeasy.in
              </a>
            </div>
            <div>
              <p className="font-medium text-[var(--muted)]">Product site</p>
              <a
                href="https://spkeasy.in"
                className="mt-1 inline-block font-semibold text-[var(--accent-deep)] hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                spkeasy.in
              </a>
            </div>
          </div>
        </Panel>
      </main>

      <SiteFooter />
    </Shell>
  );
}
