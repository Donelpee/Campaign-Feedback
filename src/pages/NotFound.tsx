import { useLocation } from "react-router-dom";
import { useEffect } from "react";

/**
 * 404 Not Found page for unknown routes.
 * Accessibility: Semantic HTML, clear headings, accessible link.
 */
export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    // Log 404 navigation for debugging/analytics
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-muted"
      role="main"
      aria-labelledby="notfound-heading"
    >
      <section className="text-center">
        <h1
          id="notfound-heading"
          className="mb-4 text-4xl font-bold"
          tabIndex={-1}
          aria-label="404 Not Found"
        >
          404
        </h1>
        <p className="mb-4 text-xl text-muted-foreground">
          Oops! Page not found
        </p>
        <a
          href="/"
          className="text-primary underline hover:text-primary/90"
          aria-label="Return to Home"
        >
          Return to Home
        </a>
      </section>
    </main>
  );
}
