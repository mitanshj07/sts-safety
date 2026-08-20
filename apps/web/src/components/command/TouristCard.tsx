// apps/web/src/components/command/TouristCard.tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChainProofBadge } from "@/components/command/ChainProofBadge"
import type { DigitalIdCard, LiveTourist } from "@/lib/command/types"
import type { EmergencyContact } from "@sts/shared"

export function TouristCard({
  tourist,
  contacts,
  digitalId,
  photoUrl,
}: {
  tourist: Pick<
    LiveTourist,
    "full_name" | "nationality" | "photo_path" | "phone_e164" | "safety_score"
  >
  contacts: EmergencyContact[]
  digitalId: DigitalIdCard
  photoUrl?: string | null
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12">
          {photoUrl ? <AvatarImage src={photoUrl} alt={tourist.full_name} /> : null}
          <AvatarFallback>
            {tourist.full_name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{tourist.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {tourist.nationality} · score {tourist.safety_score}
            {tourist.phone_e164 ? ` · ${tourist.phone_e164}` : ""}
          </p>
          <div className="mt-2">
            <ChainProofBadge
              kind="identity"
              tokenId={digitalId.token_id}
              idStatus={digitalId.status}
            />
          </div>
        </div>
      </div>
      <ul className="mt-3 space-y-1">
        {contacts.length === 0 ? (
          <li className="text-xs text-muted-foreground">No emergency contacts on file.</li>
        ) : (
          contacts.map((contact) => (
            <li key={`${contact.name}-${contact.phone_e164}`} className="text-xs">
              <span className="font-medium">{contact.name}</span>{" "}
              <span className="text-muted-foreground">
                ({contact.relation}) {contact.phone_e164}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
