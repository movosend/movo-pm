import { auth } from "@/auth"
import { signOutAction } from "@/app/(app)/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { isAdmin } from "@/lib/workspaces/access"

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (isAdmin(session?.user?.id)) return children

  const needsSignIn = Boolean(session?.user && !session.user.id)
  return (
    <div className="mx-auto flex max-w-lg items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            {needsSignIn ? "Actualizá tu sesión" : "Acceso no disponible"}
          </CardTitle>
          <CardDescription>
            {needsSignIn
              ? "Tu sesión es anterior al nuevo acceso por workspace. Volvé a entrar con GitHub para confirmar tu cuenta de administrador."
              : "Esta cuenta de GitHub no tiene permiso de administrador."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOutAction}>
            <Button type="submit">
              {needsSignIn ? "Volver a entrar" : "Entrar con otra cuenta"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
