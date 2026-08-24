import { Switch, Route, Redirect, useLocation } from "wouter";
import HallOfFame from "@/pages/HallOfFame";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import CategoryPage from "@/pages/CategoryPage";
import ArtistDetail from "@/pages/ArtistDetail";
import Admin from "@/pages/Admin";
import NominateArtist from "@/pages/NominateArtist";
import NomineeShare from "@/pages/NomineeShare";
import CheckMyVotes from "@/pages/CheckMyVotes";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ApprovalCelebration } from "@/components/ApprovalCelebration";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);
  return null;
}

function Router() {
  return (
    <div className="flex flex-col min-h-screen">
      <ScrollToTop />
      <Navbar />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/category/:categoryId" component={CategoryPage} />
          <Route path="/artist/:id" component={ArtistDetail} />
          <Route path="/admin" component={Admin} />
          <Route path="/nominate" component={NominateArtist} />
          <Route path="/n/:id" component={NomineeShare} />
          <Route path="/my-votes" component={CheckMyVotes} />
          <Route path="/hall-of-fame" component={HallOfFame} />
          <Route><Redirect to="/" /></Route>
        </Switch>
      </main>
      <Footer />
      <ApprovalCelebration />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
