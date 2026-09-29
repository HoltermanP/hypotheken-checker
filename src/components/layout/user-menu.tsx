"use client"

import { Show, SignInButton, UserButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"

export function UserMenu() {
  return (
    <>
      <Show when="signed-in">
        <UserButton />
      </Show>
      <Show when="signed-out">
        <SignInButton>
          <Button size="sm">Inloggen</Button>
        </SignInButton>
      </Show>
    </>
  )
}
