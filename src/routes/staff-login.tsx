import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Brand } from "@/components/Brand";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/staff-login")({
  head: () => ({
    meta: [
      { title: "Staff & Admin sign in — MoveEasy" },
      { name: "description", content: "Restricted sign in for MoveEasy staff and administrators." },
    ],
  }),
  component: StaffLoginPage,
});

const STAFF_ROLES = new Set(["admin", "super_admin", "staff", "payment_approver"]);

function StaffLoginPage() {
  const nav = useNavigate();
  const { user, role, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  // Auto-redirect: staff to /app, customers signed in here are not allowed
  useEffect(() => {
    if (loading || !user || !role) return;
    if (STAFF_ROLES.has(role)) {
      nav({ to: "/app" });
    } else {
      // Customer accounts shouldn't sit on the staff login screen
      toast.error("This sign-in is for staff and admins only.");
      supabase.auth.signOut();
    }
  }, [loading, user, role, nav]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }

    // Verify the signed-in user has a staff/admin role; otherwise sign out
    const uid = data.user?.id;
    if (uid) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      const allowed = roles?.some((r: { role: string }) => STAFF_ROLES.has(r.role));
      if (!allowed) {
        await supabase.auth.signOut();
        setBusy(false);
        toast.error("Access denied", {
          description: "This account doesn't have staff or admin permissions.",
        });
        return;
      }
    }
    setBusy(false);
    toast.success("Welcome back");
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent");
    setForgotOpen(false);
    setForgotEmail("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-secondary/30">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Brand size="md" />
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Restricted access</span>
          </div>
          <h1 className="text-2xl font-bold mt-2">Staff &amp; Admin sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">
            For MoveEasy team members. Customers should use the{" "}
            <Link to="/auth" className="text-primary hover:underline">
              customer portal sign in
            </Link>
            .
          </p>

          <form onSubmit={handleSignIn} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="staff-email">Work email</Label>
              <Input
                id="staff-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="staff-pwd">Password</Label>
                <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setForgotEmail(email)}
                    >
                      Forgot password?
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reset your password</DialogTitle>
                      <DialogDescription>
                        Enter your work email and we'll send you a reset link.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-staff-email">Email</Label>
                        <Input
                          id="forgot-staff-email"
                          type="email"
                          required
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                        />
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={forgotBusy} className="w-full">
                          {forgotBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Send reset link
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Input
                id="staff-pwd"
                type="password"
                required
                autoComplete="current-password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Staff accounts are created by an administrator. Self sign-up is disabled here.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
