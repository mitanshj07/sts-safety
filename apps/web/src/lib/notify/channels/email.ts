// apps/web/src/lib/notify/channels/email.ts
import "server-only";

import { Resend } from "resend";

import { storageBuckets } from "@/lib/chain/env";
import { serverEnv } from "@/lib/env/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { NotConfiguredError, TransientNotifyError } from "@/lib/notify/errors";
import { EfirEmail } from "@/lib/notify/templates/EfirEmail";
import { IncidentAlertEmail } from "@/lib/notify/templates/IncidentAlertEmail";
import { dashboardUrl } from "@/lib/notify/templates/messages";
import type {
  ChannelSendInput,
  ChannelSendResult,
  INotificationChannel,
  NotifyIncident,
} from "@/lib/notify/types";

function resendClient(): Resend {
  if (!serverEnv.resendApiKey) {
    throw new NotConfiguredError("email");
  }
  return new Resend(serverEnv.resendApiKey);
}

export const emailChannel: INotificationChannel = {
  id: "email",
  isConfigured(): boolean {
    return serverEnv.resendApiKey.length > 0 && serverEnv.resendFrom.length > 0;
  },
  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    if (!this.isConfigured()) throw new NotConfiguredError("email");
    const to = input.recipient.email;
    if (!to) return { providerRef: null, delivered: true };
    const coords =
      input.incident.lat !== null && input.incident.lon !== null
        ? `${input.incident.lat.toFixed(5)}, ${input.incident.lon.toFixed(5)}`
        : "n/a";
    const { data, error } = await resendClient().emails.send({
      from: serverEnv.resendFrom,
      to,
      subject: input.title,
      react: IncidentAlertEmail({
        title: input.title,
        body: input.body,
        touristName: input.incident.touristName ?? "Unknown tourist",
        severity: input.incident.severity,
        type: input.incident.type,
        where: input.incident.zoneName ?? input.incident.addressText ?? "unlocated",
        coords,
        occurredAt: input.incident.occurredAt,
        dashboardUrl: dashboardUrl(serverEnv.appUrl, input.incident.id),
      }),
    });
    if (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 429 || (typeof status === "number" && status >= 500)) {
        throw new TransientNotifyError(error.message, status);
      }
      throw new Error(error.message);
    }
    return { providerRef: data?.id ?? null, delivered: true };
  },
};

export async function sendEfirEmail(input: {
  incident: Pick<NotifyIncident, "id" | "touristName" | "type" | "occurredAt">;
  narrative: string;
  stationName: string;
  pdfPath: string | null;
  pdfBuffer?: Buffer | null;
  to?: string;
}): Promise<ChannelSendResult> {
  if (!emailChannel.isConfigured()) {
    throw new NotConfiguredError("email");
  }
  const to = input.to ?? serverEnv.authorityEmail;
  if (!to) {
    throw new NotConfiguredError("email", "AUTHORITY_EMAIL is empty");
  }

  const attachments: Array<{ filename: string; content: Buffer }> = [];
  if (input.pdfBuffer) {
    attachments.push({
      filename: `efir-${input.incident.id.slice(0, 8)}.pdf`,
      content: input.pdfBuffer,
    });
  } else if (input.pdfPath) {
    const admin = createAdminSupabase();
    const { data, error } = await admin.storage
      .from(storageBuckets().efir)
      .download(input.pdfPath);
    if (!error && data) {
      attachments.push({
        filename: `efir-${input.incident.id.slice(0, 8)}.pdf`,
        content: Buffer.from(await data.arrayBuffer()),
      });
    }
  }

  const { data, error } = await resendClient().emails.send({
    from: serverEnv.resendFrom,
    to,
    subject: `E-FIR draft · ${input.incident.touristName ?? "tourist"} · ${input.incident.type}`,
    react: EfirEmail({
      touristName: input.incident.touristName ?? "Unknown tourist",
      incidentId: input.incident.id,
      narrative: input.narrative,
      stationName: input.stationName,
      occurredAt: input.incident.occurredAt,
    }),
    attachments: attachments.length > 0 ? attachments : undefined,
  });
  if (error) {
    throw new Error(error.message);
  }
  return { providerRef: data?.id ?? null, delivered: true };
}
