import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { workspaceMembers } from "@/lib/db/schema"

const adminIds = () =>
  (process.env.ADMIN_GITHUB_IDS ?? "").split(",").map((id) => id.trim())

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    GitHub({
      authorization: { params: { scope: "read:user user:email" } },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider !== "github") return false

      const accessToken = account.access_token
      if (!accessToken || !profile?.id) return false
      const emailsResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
        },
      })
      if (!emailsResponse.ok) return false
      const emails = (await emailsResponse.json()) as {
        email: string
        primary: boolean
        verified: boolean
      }[]
      const email = emails
        .find((entry) => entry.primary && entry.verified)
        ?.email.toLowerCase()
      if (!email) return false
      user.email = email
      user.id = String(profile.id)

      if (adminIds().includes(user.id)) return true

      const [allowed] = await db
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.email, email))
        .limit(1)

      return Boolean(allowed)
    },
    authorized({ auth }) {
      return Boolean(auth?.user)
    },
    jwt({ token, user }) {
      if (user) {
        token.githubId = user.id
        token.email = user.email
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.githubId ?? "")
        session.user.email = typeof token.email === "string" ? token.email : ""
      }
      return session
    },
  },
})
