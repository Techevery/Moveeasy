import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";
import { ArrowRight, BarChart3, Bell, Boxes, CreditCard, ShieldCheck, Users } from "lucide-react";
import hero from "@/assets/hero-storage.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MoveEasy — Simple Smart Storage Management" },
      { name: "description", content: "Run your storage facility with elegance. Manage units, customers, rentals, payments and automated reminders in one premium dashboard." },
      { property: "og:title", content: "MoveEasy — Simple Smart Storage Management" },
      { property: "og:description", content: "The modern self-storage management platform." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Brand />
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="shadow-[var(--shadow-elegant)]">
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, oklch(0.62 0.18 150 / 0.18) 0%, transparent 60%)",
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-24 lg:pt-24 lg:pb-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs font-medium">
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                New · Multi-currency support
              </span>
              <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
                Simple, smart{" "}
                <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
                  storage management
                </span>
              </h1>
              <p className="mt-5 text-lg text-muted-foreground max-w-xl">
                MoveEasy helps storage facility owners manage units, customers,
                rentals, payments and reminders — all from one elegant dashboard
                your customers will love.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="shadow-[var(--shadow-elegant)]">
                  <Link to="/auth">
                    Start free <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#features">See features</a>
                </Button>
              </div>
              <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Bank-grade security</div>
                <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Automated reminders</div>
              </div>
            </div>
            <div className="relative">
              <div
                className="absolute -inset-6 rounded-3xl blur-2xl -z-10 opacity-50"
                style={{ background: "var(--gradient-primary)" }}
              />
              <img
                src={hero}
                alt="Modern self-storage facility"
                width={1600}
                height={900}
                className="rounded-2xl shadow-[var(--shadow-elegant)] border"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 border-t bg-gradient-to-b from-background to-secondary/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Everything you need to run a facility</h2>
            <p className="mt-3 text-muted-foreground">From the front desk to the final receipt — beautifully connected.</p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Boxes, title: "Unit inventory", desc: "Track every unit with size, pricing, occupancy and notes." },
              { icon: Users, title: "Customer CRM", desc: "Profiles, IDs, next of kin and full payment history." },
              { icon: CreditCard, title: "Payment tracking", desc: "Cash, transfer, POS or online — one ledger, zero leaks." },
              { icon: Bell, title: "Smart reminders", desc: "Automated alerts before due dates and after overdue." },
              { icon: BarChart3, title: "Live dashboard", desc: "Occupancy, revenue and overdue debtors at a glance." },
              { icon: ShieldCheck, title: "Role-based access", desc: "Admins, staff and customers each see what they should." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] transition-shadow">
                <div className="size-10 rounded-lg flex items-center justify-center bg-accent text-accent-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ready to make storage feel effortless?</h2>
          <p className="mt-3 text-muted-foreground">Create your account in under a minute. No credit card required.</p>
          <div className="mt-8">
            <Button asChild size="lg" className="shadow-[var(--shadow-elegant)]">
              <Link to="/auth">Get started free</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <Brand size="sm" />
          <p>© {new Date().getFullYear()} MoveEasy · Simple Smart Storage Management</p>
        </div>
      </footer>
    </div>
  );
}
