import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, User } from "lucide-react";
import { AuthShell, GoogleButton } from "@/components/site/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, type Role } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type SignupFormValues = z.infer<typeof schema>;

function SignupPage() {
  const { signup, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("candidate");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignupFormValues) => {
    try {
      await signup(data.name, data.email, data.password, role);
      toast.success("Account created!");
      navigate({ to: role === "company" ? "/company" : "/dashboard" });
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    }
  };

  const onGoogleSignup = async () => {
    try {
      await googleLogin(role);
      toast.success("Account created with Google");
      navigate({ to: role === "company" ? "/company" : "/dashboard" });
    } catch (error: any) {
      toast.error(error.message || "Failed to sign up with Google");
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start free — no credit card required."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: "candidate", label: "Candidate", icon: User },
              { value: "company", label: "Company", icon: Building2 },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRole(opt.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border p-4 text-sm font-medium transition-all",
                role === opt.value
                  ? "border-primary bg-accent/50 text-accent-foreground ring-2 ring-primary/30"
                  : "border-border hover:border-primary/40",
              )}
            >
              <opt.icon className="h-5 w-5" />
              {opt.label}
            </button>
          ))}
        </div>

        <GoogleButton onClick={onGoogleSignup} label="Sign up with Google" />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" placeholder="Jane Doe" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" variant="hero" className="w-full" size="lg">
            Create account
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
