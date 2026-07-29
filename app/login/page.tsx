import { Button } from "@/components/ui/button"
import { signIn } from "@/auth"

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-xs flex-col gap-4 text-center">
        <div>
          <h1 className="text-lg font-medium">Movo PM</h1>
          <p className="text-sm text-muted-foreground">
            Acceso exclusivo para el equipo de Movo.
          </p>
        </div>
        <form
          action={async () => {
            "use server"
            await signIn("github", { redirectTo: "/" })
          }}
        >
          <Button type="submit" className="w-full">
            Entrar con GitHub
          </Button>
        </form>
      </div>
    </div>
  )
}
