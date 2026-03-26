import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  BarChart3,
  ClipboardList,
  Shield,
  Users,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { NkowaLogo } from "@/components/branding/NkowaLogo";

export default function Index() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.35)_100%)]">
      <header className="border-b border-border/70 bg-background/75 backdrop-blur-md" role="banner">
        <div className="mx-auto flex h-28 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center text-primary" aria-label="App logo">
            <NkowaLogo showTagline={false} size="lg" className="scale-[0.95] sm:scale-100" />
          </div>
          <Button asChild>
            <Link to="/auth">Admin Login</Link>
          </Button>
        </div>
      </header>

      <section className="px-4 pt-16 pb-12" aria-labelledby="hero-heading">
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="inline-flex items-center rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
              Enterprise Feedback Intelligence
            </p>
            <h1 id="hero-heading" className="mt-4 text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
              Turn campaign responses into boardroom-ready insights.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              Build feedback campaigns, share secure links, and monitor response quality with a
              modern analytics workspace designed for client-facing teams.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href="#features">Explore Features</a>
              </Button>
            </div>
          </div>

          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="text-xl">What you can manage</CardTitle>
              <CardDescription>Everything in one professional command center.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                "Multi-company campaign planning",
                "Secure unique response links",
                "Dynamic question analytics and exports",
                "Role-based admin permissions",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/80 p-3"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-accent" />
                  <p className="text-sm text-foreground">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="features" className="px-4 py-14" aria-labelledby="features-heading">
        <div className="mx-auto max-w-7xl">
          <h2 id="features-heading" className="mb-10 text-center text-3xl font-bold tracking-tight">
            Key Features
          </h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <ClipboardList className="mb-2 h-9 w-9 text-primary" aria-hidden />
                <CardTitle>Anonymous Feedback</CardTitle>
                <CardDescription>
                  Collect honest responses without exposing respondent identities.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Users className="mb-2 h-9 w-9 text-primary" aria-hidden />
                <CardTitle>Multi-Company Ops</CardTitle>
                <CardDescription>
                  Manage campaigns and data segmentation across all client accounts.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <BarChart3 className="mb-2 h-9 w-9 text-primary" aria-hidden />
                <CardTitle>Executive Analytics</CardTitle>
                <CardDescription>
                  Track KPIs, trends, and response quality in real time.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Shield className="mb-2 h-9 w-9 text-primary" aria-hidden />
                <CardTitle>Secure by Design</CardTitle>
                <CardDescription>
                  Role-based access controls with enterprise-ready governance.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-4 py-16" aria-labelledby="how-heading">
        <div className="mx-auto max-w-4xl">
          <h2 id="how-heading" className="mb-10 text-center text-3xl font-bold">
            How It Works
          </h2>
          <ol className="space-y-5" aria-label="How it works steps">
            {[
              "Add your client companies",
              "Create campaign forms with your preferred builder mode",
              "Generate and share unique feedback links",
              "Analyze responses and export client-ready reports",
            ].map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-4 rounded-2xl border border-border/70 bg-card/80 p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {index + 1}
                </div>
                <p className="font-medium leading-7 text-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 pb-16" aria-labelledby="cta-heading">
        <div className="mx-auto max-w-5xl rounded-3xl border border-border/70 bg-primary px-6 py-12 text-center text-primary-foreground shadow-[0_18px_55px_hsl(var(--primary)/0.28)]">
          <h2 id="cta-heading" className="mb-3 text-3xl font-bold">
            Ready to launch your next campaign?
          </h2>
          <p className="mb-7 text-primary-foreground/90">
            Access the admin portal and start building campaigns with data-driven reporting.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/auth">Go to Admin Portal</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/70 px-4 py-8" role="contentinfo">
        <div className="mx-auto max-w-7xl text-center text-sm text-muted-foreground">
          <p>Copyright {new Date().getFullYear()} Nkọwa. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
