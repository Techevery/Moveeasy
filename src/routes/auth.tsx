import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Brand } from "@/components/Brand";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — MoveEasy" },
      { name: "description", content: "Sign in or create an account on MoveEasy storage management." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { user, role, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    if (!loading && user && role) {
      nav({ to: role === "customer" ? "/portal" : "/app" });
    }
  }, [loading, user, role, nav]);

  // Sign in
  const [siEmail, setSiEmail] = useState("");
  const [siPwd, setSiPwd] = useState("");

  // Forgot password
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent", {
      description: "Check your email for instructions to reset your password.",
    });
    setForgotOpen(false);
    setForgotEmail("");
  }

  // Sign up
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPhone, setSuPhone] = useState("");
  const [suPwd, setSuPwd] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPwd });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: suEmail,
      password: suPwd,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: suName, phone: suPhone },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! Please sign in.");
    // Prefill the sign-in email and switch to the sign-in tab
    setSiEmail(suEmail);
    setSuName("");
    setSuEmail("");
    setSuPhone("");
    setSuPwd("");
    setTab("signin");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Brand size="md" />
        </div>
          <h1 className="text-2xl font-bold">Welcome to MoveEasy</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to your account or create a new one. Staff and admins{" "}
            <a href="/staff-login" className="text-primary hover:underline">sign in here</a>.
          </p>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="mt-6">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" required value={siEmail} onChange={(e) => setSiEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="si-pwd">Password</Label>
                    <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => setForgotEmail(siEmail)}
                        >
                          Forgot password?
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Reset your password</DialogTitle>
                          <DialogDescription>
                            Enter your email and we'll send you a link to reset your password.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleForgotPassword} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="forgot-email">Email</Label>
                            <Input
                              id="forgot-email"
                              type="email"
                              required
                              value={forgotEmail}
                              onChange={(e) => setForgotEmail(e.target.value)}
                            />
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={forgotBusy} className="w-full">
                              {forgotBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send reset link
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Input id="si-pwd" type="password" required value={siPwd} onChange={(e) => setSiPwd(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Full name</Label>
                  <Input id="su-name" required value={suName} onChange={(e) => setSuName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" required value={suEmail} onChange={(e) => setSuEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-phone">Phone</Label>
                  <Input id="su-phone" value={suPhone} onChange={(e) => setSuPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-pwd">Password</Label>
                  <Input id="su-pwd" type="password" minLength={6} required value={suPwd} onChange={(e) => setSuPwd(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create account
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  New accounts default to the Customer portal. An admin can promote you to staff.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
  );
}


