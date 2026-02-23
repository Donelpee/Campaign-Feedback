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

export default function Index() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.35)_100%)]">
      <header className="border-b border-border/70 bg-background/75 backdrop-blur-md" role="banner">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary" aria-label="App logo and name">
            <BarChart3 className="h-8 w-8" aria-hidden />
            <span className="text-xl font-bold tracking-tight">FeedbackHub</span>
          </div>
          <Button asChild>
            <Link to="/auth">Admin Login</Link>
          </Button>
        </div>
      </header>

      <section className="px-4 pt-16 pb-12" aria-labelledby="hero-heading">
        <div className="mx-auto max-w-7xl grid gap-8 lg:grid-cols-[1.15fr_0.85fr] items-center">
          <div>
            <p className="inline-flex items-center rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
              Enterprise Feedback Intelligence
            </p>
            <h1 id="hero-heading" className="mt-4 text-4xl md:text-6xl font-extrabold tracking-tight text-foreground">
              Turn campaign responses into boardroom-ready insights.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-2xl">
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

          <Card className="bg-card/90 border-border/70">
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
                <div key={item} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/80 p-3">
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
          <h2 id="features-heading" className="text-3xl font-bold tracking-tight text-center mb-10">
            Key Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <Card>
              <CardHeader>
                <ClipboardList className="h-9 w-9 text-primary mb-2" aria-hidden />
                <CardTitle>Anonymous Feedback</CardTitle>
                <CardDescription>Collect honest responses without exposing respondent identities.</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Users className="h-9 w-9 text-primary mb-2" aria-hidden />
                <CardTitle>Multi-Company Ops</CardTitle>
                <CardDescription>Manage campaigns and data segmentation across all client accounts.</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <BarChart3 className="h-9 w-9 text-primary mb-2" aria-hidden />
                <CardTitle>Executive Analytics</CardTitle>
                <CardDescription>Track KPIs, trends, and response quality in real time.</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Shield className="h-9 w-9 text-primary mb-2" aria-hidden />
                <CardTitle>Secure by Design</CardTitle>
                <CardDescription>Role-based access controls with enterprise-ready governance.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-4 py-16" aria-labelledby="how-heading">
        <div className="mx-auto max-w-4xl">
          <h2 id="how-heading" className="text-3xl font-bold text-center mb-10">
            How It Works
          </h2>
          <ol className="space-y-5" aria-label="How it works steps">
            {[
              "Add your client companies",
              "Create campaign forms with your preferred builder mode",
              "Generate and share unique feedback links",
              "Analyze responses and export client-ready reports",
            ].map((step, index) => (
              <li key={step} className="flex gap-4 items-start rounded-2xl border border-border/70 bg-card/80 p-4">
                <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                  {index + 1}
                </div>
                <p className="text-foreground font-medium leading-7">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 pb-16" aria-labelledby="cta-heading">
        <div className="mx-auto max-w-5xl rounded-3xl border border-border/70 bg-primary text-primary-foreground px-6 py-12 text-center shadow-[0_18px_55px_hsl(var(--primary)/0.28)]">
          <h2 id="cta-heading" className="text-3xl font-bold mb-3">
            Ready to launch your next campaign?
          </h2>
          <p className="text-primary-foreground/90 mb-7">
            Access the admin portal and start building campaigns with data-driven reporting.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/auth">Go to Admin Portal</Link>
          </Button>
        </div>
      </section>

      <footer className="py-8 border-t border-border/70 px-4" role="contentinfo">
        <div className="mx-auto max-w-7xl text-center text-sm text-muted-foreground">
          <p>Copyright {new Date().getFullYear()} FeedbackHub. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
