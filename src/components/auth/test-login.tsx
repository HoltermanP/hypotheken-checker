import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { isE2ETestMode } from "@/env"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/** Alleen in E2E_TEST_MODE: inloggen met een test-id (nooit in productie). */
async function testLogin(form: FormData) {
  "use server"
  if (!isE2ETestMode()) throw new Error("Niet beschikbaar")
  const user = String(form.get("user") ?? "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "testgebruiker"
  const jar = await cookies()
  jar.set("e2e_user", `test_${user}`, { httpOnly: true, sameSite: "lax", path: "/" })
  jar.set("e2e_role", form.get("admin") === "on" ? "admin" : "user", { httpOnly: true, sameSite: "lax", path: "/" })
  redirect("/app")
}

export function TestLogin() {
  return (
    <form action={testLogin} className="w-full max-w-sm space-y-4 rounded-xl border p-6">
      <h1 className="text-lg font-semibold">Testmodus: inloggen</h1>
      <p className="text-sm text-muted-foreground">Deze pagina bestaat alleen in de lokale e2e-testmodus.</p>
      <div className="space-y-1.5">
        <Label htmlFor="user">Test-gebruiker</Label>
        <Input id="user" name="user" defaultValue="e2e" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="admin" /> Beheerder
      </label>
      <Button type="submit">Inloggen</Button>
    </form>
  )
}
