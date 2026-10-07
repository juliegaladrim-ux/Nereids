"use client"

import * as React from "react"

import { getRole, type Role, type RoleId } from "@/lib/roles"
import { getUser, type User } from "@/lib/data"

type RoleCtx = { role: Role; user: User; href: (path?: string) => string }

const RoleContext = React.createContext<RoleCtx | null>(null)

export function RoleProvider({ roleId, children }: { roleId: RoleId; children: React.ReactNode }) {
  const value = React.useMemo(() => {
    const role = getRole(roleId)!
    return {
      role,
      user: getUser(role.userId)!,
      href: (path = "tableau-de-bord") => `/${role.id}/${path}`.replace(/\/+$/, ""),
    }
  }, [roleId])
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole(): RoleCtx {
  const ctx = React.useContext(RoleContext)
  if (!ctx) throw new Error("useRole doit être utilisé dans <RoleProvider>")
  return ctx
}
