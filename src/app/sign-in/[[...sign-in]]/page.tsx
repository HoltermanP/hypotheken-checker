import { SignIn } from "@clerk/nextjs"
import { isE2ETestMode } from "@/env"
import { TestLogin } from "@/components/auth/test-login"

export default function SignInPage() {
  return (
    <main id="main" className="flex flex-1 items-center justify-center p-4">
      {isE2ETestMode() ? <TestLogin /> : <SignIn />}
    </main>
  )
}
