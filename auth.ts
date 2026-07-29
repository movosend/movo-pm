import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { allowedUsers } from "@/lib/db/schema"

const GITHUB_ORG = "movosend"

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    GitHub({
      authorization: { params: { scope: "read:user user:email read:org" } },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider !== "github") return false

      const login = (profile as { login?: string } | undefined)?.login
      const accessToken = account.access_token
      if (!login || !accessToken) return false

      const membership = await fetch(
        `https://api.github.com/orgs/${GITHUB_ORG}/members/${login}`,
        { headers: { Authorization: `token ${accessToken}` } }
      )
      if (membership.status !== 204) return false

      const email = user.email?.toLowerCase()
      if (!email) return false

      const [allowed] = await db
        .select()
        .from(allowedUsers)
        .where(eq(allowedUsers.email, email))
        .limit(1)

      return Boolean(allowed)
    },
    authorized({ auth }) {
      return Boolean(auth?.user)
    },
  },
})
