import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, ClipboardList, Shield, Users } from 'lucide-react';

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2 text-primary">
            <BarChart3 className="h-8 w-8" />
            <span className="text-xl font-bold">FeedbackHub</span>
          </div>
          <Button asChild>
            <Link to="/auth">Admin Login</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Quarterly Feedback Collection System
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Collect anonymous feedback from your client companies with ease. Generate unique links, 
            track responses, and gain actionable insights through our comprehensive dashboard.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button asChild size="lg">
              <Link to="/auth">Get Started</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="#features">Learn More</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-muted/50 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Key Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <ClipboardList className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Anonymous Feedback</CardTitle>
                <CardDescription>
                  Collect honest feedback without identifying individual respondents
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Multi-Company Support</CardTitle>
                <CardDescription>
                  Manage up to 30+ companies with data segregation and unique URLs
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Visual Dashboard</CardTitle>
                <CardDescription>
                  Track KPIs, satisfaction scores, and trends with interactive charts
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Secure & Private</CardTitle>
                <CardDescription>
                  Enterprise-grade security with role-based access control
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="space-y-8">
            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Add Your Client Companies</h3>
                <p className="text-muted-foreground">
                  Set up your client companies in the admin dashboard. Each company will have its own segregated data.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Create Quarterly Campaigns</h3>
                <p className="text-muted-foreground">
                  Set up feedback campaigns with specific start and end dates for each quarter.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Generate & Share Unique Links</h3>
                <p className="text-muted-foreground">
                  Generate unique feedback URLs for each company-campaign combination and share them with staff.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">
                4
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Analyze Results</h3>
                <p className="text-muted-foreground">
                  View comprehensive dashboards with satisfaction scores, trends, and company comparisons.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary text-primary-foreground px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Collecting Feedback?</h2>
          <p className="text-lg opacity-90 mb-8">
            Sign in to access the admin dashboard and set up your first campaign.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/auth">Go to Admin Portal</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} FeedbackHub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
