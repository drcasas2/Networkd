import { google, calendar_v3 } from "googleapis";
import { prisma } from "./prisma";

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  );
}

/**
 * Returns a Google Calendar client authenticated as the given user, using the
 * refresh token stored by Auth.js. Throws if the user has no Google account on file.
 */
export async function getCalendarClient(userId: string): Promise<calendar_v3.Calendar> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account?.refresh_token) {
    throw new Error("User has no Google account connected");
  }
  const oauth2 = oauthClient();
  oauth2.setCredentials({
    refresh_token: account.refresh_token,
    access_token: account.access_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  // Persist refreshed access tokens so subsequent calls don't re-refresh.
  oauth2.on("tokens", async (tokens) => {
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: tokens.access_token ?? account.access_token,
        expires_at: tokens.expiry_date
          ? Math.floor(tokens.expiry_date / 1000)
          : account.expires_at,
      },
    });
  });

  return google.calendar({ version: "v3", auth: oauth2 });
}

export async function getFreeBusy(
  userId: string,
  from: Date,
  to: Date,
): Promise<Array<{ start: string; end: string }>> {
  const cal = await getCalendarClient(userId);
  const res = await cal.freebusy.query({
    requestBody: {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      items: [{ id: "primary" }],
    },
  });
  const busy = res.data.calendars?.primary?.busy ?? [];
  return busy
    .filter((b): b is { start: string; end: string } => !!b.start && !!b.end)
    .map((b) => ({ start: b.start, end: b.end }));
}

export async function createMeetingEvent(opts: {
  expertUserId: string;
  clientEmail: string;
  startsAt: Date;
  endsAt: Date;
  summary: string;
  description?: string;
}): Promise<{ eventId: string; meetLink: string | null }> {
  const cal = await getCalendarClient(opts.expertUserId);
  const requestId = `networkd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const res = await cal.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: opts.summary,
      description: opts.description,
      start: { dateTime: opts.startsAt.toISOString() },
      end: { dateTime: opts.endsAt.toISOString() },
      attendees: [{ email: opts.clientEmail }],
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });
  const eventId = res.data.id;
  if (!eventId) throw new Error("Failed to create calendar event");
  const meetLink =
    res.data.hangoutLink ??
    res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
    null;
  return { eventId, meetLink };
}

export async function deleteCalendarEvent(expertUserId: string, eventId: string): Promise<void> {
  const cal = await getCalendarClient(expertUserId);
  await cal.events.delete({
    calendarId: "primary",
    eventId,
    sendUpdates: "all",
  });
}
