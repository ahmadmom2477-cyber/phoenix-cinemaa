import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, lazy, Suspense } from "react";
import { LangProvider } from "@/contexts/lang";

import { Layout } from "@/components/layout";
import { SubscriptionGate } from "@/components/subscription-gate";
import Home from "@/pages/home";

const Search      = lazy(() => import("@/pages/search"));
const Watch       = lazy(() => import("@/pages/watch"));
const Genres      = lazy(() => import("@/pages/genres"));
const Genre       = lazy(() => import("@/pages/genre"));
const Movies      = lazy(() => import("@/pages/movies"));
const Series      = lazy(() => import("@/pages/series"));
const Watchlist   = lazy(() => import("@/pages/watchlist"));
const Collections = lazy(() => import("@/pages/collections"));
const Collection  = lazy(() => import("@/pages/collection"));
const About       = lazy(() => import("@/pages/about"));
const Admin       = lazy(() => import("@/pages/admin"));
const NotFound    = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5 * 60 * 1000 },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/search" component={Search} />
        <Route path="/movies" component={Movies} />
        <Route path="/series" component={Series} />
        <Route path="/watchlist" component={Watchlist} />
        <Route path="/collections" component={Collections} />
        <Route path="/collection/:id" component={Collection} />
        <Route path="/genres" component={Genres} />
        <Route path="/genre/:name" component={Genre} />
        <Route path="/watch/:imdbId" component={Watch} />
        <Route path="/about" component={About} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Keep Render free-tier server awake — ping every 10 min while tab is visible
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === "visible") {
        fetch("/api/healthz", { method: "GET", cache: "no-store" }).catch(() => {});
      }
    };
    const id = setInterval(ping, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <SubscriptionGate>
              <Layout>
                <Router />
              </Layout>
            </SubscriptionGate>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </LangProvider>
    </QueryClientProvider>
  );
}

export default App;
