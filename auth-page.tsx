import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const authSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
  password: z
    .string()
    .min(4, "Password must be at least 4 characters")
    .max(100, "Password must be at most 100 characters"),
});

type AuthFormData = z.infer<typeof authSchema>;

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  const [usernameToCheck, setUsernameToCheck] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const form = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const checkUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await apiRequest("GET", `/api/check-username/${username}`);
      return await res.json();
    },
    onSuccess: (data: { available: boolean }) => {
      setUsernameAvailable(data.available);
      setCheckingUsername(false);
    },
    onError: () => {
      setUsernameAvailable(null);
      setCheckingUsername(false);
    },
  });

  useEffect(() => {
    if (!isLogin && usernameToCheck.length >= 3) {
      const timer = setTimeout(() => {
        setCheckingUsername(true);
        checkUsernameMutation.mutate(usernameToCheck);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setUsernameAvailable(null);
    }
  }, [usernameToCheck, isLogin]);

  if (user) {
    setLocation("/");
    return null;
  }

  const onSubmit = (data: AuthFormData) => {
    if (isLogin) {
      loginMutation.mutate(data);
    } else {
      registerMutation.mutate(data);
    }
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen flex bg-background">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md border-4 border-foreground p-12 space-y-8">
          <div className="text-center border-b-4 border-foreground pb-6 mb-8">
            <h1 className="text-4xl font-bold tracking-tight uppercase">
              {isLogin ? "LOGIN" : "REGISTER"}
            </h1>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-widest font-bold">
                      USERNAME
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          data-testid="input-username"
                          className="border-0 border-b-2 border-foreground p-4 text-base focus-visible:ring-0 focus-visible:border-b-4 bg-transparent pr-24"
                          placeholder="Enter your username"
                          onChange={(e) => {
                            field.onChange(e);
                            setUsernameToCheck(e.target.value);
                          }}
                        />
                        {!isLogin && field.value.length >= 3 && (
                          <span className="absolute right-0 top-1/2 -translate-y-1/2 font-mono text-xs uppercase tracking-wide flex items-center gap-1">
                            {checkingUsername ? (
                              "..."
                            ) : usernameAvailable === true ? (
                              <>
                                <span className="w-2 h-2 bg-foreground inline-block" />
                                AVAILABLE
                              </>
                            ) : usernameAvailable === false ? (
                              <>
                                <span className="w-2 h-2 border-2 border-foreground inline-block" />
                                TAKEN
                              </>
                            ) : null}
                          </span>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage className="border-l-4 border-foreground pl-2 text-sm mt-1" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-widest font-bold">
                      PASSWORD
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          data-testid="input-password"
                          className="border-0 border-b-2 border-foreground p-4 text-base focus-visible:ring-0 focus-visible:border-b-4 bg-transparent pr-16"
                          placeholder="Enter your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-0 top-1/2 -translate-y-1/2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? "HIDE" : "SHOW"}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="border-l-4 border-foreground pl-2 text-sm mt-1" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                data-testid="button-submit"
                disabled={isPending || (!isLogin && usernameAvailable === false)}
                className="w-full p-6 h-auto border-4 border-foreground bg-foreground text-background font-bold uppercase tracking-widest text-sm disabled:opacity-50"
              >
                {isPending ? "PROCESSING..." : isLogin ? "ENTER" : "CREATE ACCOUNT"}
              </Button>
            </form>
          </Form>

          <div className="text-center pt-4 border-t-2 border-muted">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                form.reset();
                setUsernameAvailable(null);
                setShowPassword(false);
              }}
              data-testid="button-toggle-auth"
              className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              {isLogin ? "NEED AN ACCOUNT? REGISTER" : "HAVE AN ACCOUNT? LOGIN"}
            </button>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-foreground text-background items-center justify-center p-12">
        <div className="max-w-md space-y-8">
          <h2 className="text-5xl font-bold tracking-tight uppercase leading-tight">
            BRUTALIST
            <br />
            MESSAGING
          </h2>
          <div className="space-y-4 font-mono text-sm">
            <p className="border-l-4 border-background pl-4 opacity-80">
              MINIMAL DESIGN. MAXIMUM IMPACT.
            </p>
            <p className="border-l-4 border-background pl-4 opacity-80">
              REAL-TIME COMMUNICATION.
            </p>
            <p className="border-l-4 border-background pl-4 opacity-80">
              NO DISTRACTIONS. JUST CHAT.
            </p>
          </div>
          <div className="pt-8 border-t-2 border-background/30">
            <p className="font-mono text-xs uppercase tracking-widest opacity-60">
              BLACK AND WHITE. NOTHING MORE.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
