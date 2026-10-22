import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function WorkspaceAvatar({
  name,
  logoUrl,
  small = false,
}: {
  name: string
  logoUrl?: string | null
  small?: boolean
}) {
  return (
    <Avatar className={small ? "size-6 rounded-md" : "size-10 rounded-xl"}>
      {logoUrl && <AvatarImage src={logoUrl} alt="" />}
      <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}
