"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type ServerConfig = {
  StorageType?: string;
  EnableRegistration?: boolean;
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shouldAskUsername, setShouldAskUsername] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch("/api/server-config");
        if (!res.ok) return;
        const data = (await res.json()) as ServerConfig;
        setShouldAskUsername(true);
        setRegistrationEnabled(Boolean(data.EnableRegistration));
      } catch {
        setShouldAskUsername(true);
        setRegistrationEnabled(false);
      }
    };
    loadConfig();
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!password || (shouldAskUsername && !username)) return;

    try {
      setLoading(true);
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          ...(shouldAskUsername ? { username } : {}),
        }),
      });

      if (res.ok) {
        const redirect = searchParams.get("redirect") || "/";
        router.replace(redirect);
        return;
      }

      if (res.status === 401) {
        setError("密码错误");
        return;
      }

      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "服务器错误");
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>登录</CardTitle>
            <CardDescription>请输入访问凭证完成登录。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <FieldGroup>
                {shouldAskUsername && (
                  <Field>
                    <FieldLabel htmlFor="username">用户名</FieldLabel>
                    <Input
                      id="username"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required={shouldAskUsername}
                    />
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="password">密码</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Field>
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    loading || !password || (shouldAskUsername && !username)
                  }
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="h-4 w-4" />
                      登录中...
                    </span>
                  ) : (
                    "登录"
                  )}
                </Button>
                {registrationEnabled && (
                  <p className="text-center text-sm text-muted-foreground">
                    还没有账号？{" "}
                    <Link
                      href="/register"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      去注册
                    </Link>
                  </p>
                )}
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
