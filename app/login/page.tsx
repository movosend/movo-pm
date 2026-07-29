import Image from "next/image"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { auth, signIn } from "@/auth"
import { redirect } from "next/navigation"

function GitHubIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-1.99-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.77.11 3.06.74.8 1.19 1.83 1.19 3.09 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.21.67.8.56A10.99 10.99 0 0 0 23.5 12c0-6.35-5.15-11.5-11.5-11.5Z" />
    </svg>
  )
}

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect("/")

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Image
            src="/logo.png"
            alt="Movo"
            width={64}
            height={64}
            className="mx-auto mb-2 rounded-xl"
            priority
          />
          <CardTitle className="text-xl">Movo Project Manager</CardTitle>
          <CardDescription>
            Acceso exclusivo para el equipo de Movo. Inicia sesión con tu cuenta
            de GitHub de la organización.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server"
              await signIn("github", { redirectTo: "/" })
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              <GitHubIcon className="size-4" />
              Entrar con GitHub
            </Button>
          </form>
        </CardContent>
      </Card>
      <footer className="text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()}{" "}
        <a
          href="https://movosend.app"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Movo
        </a>
        . Todos los derechos reservados.
      </footer>
    </div>
  )
}
