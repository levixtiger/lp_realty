type FeedEvent = {
  id: string;
  title: string;
  event_type: string;
  status: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  location: string | null;
  notes: string | null;
  updated_at: string;
};

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    return new Response("Invalid calendar link", { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return new Response("Calendar service unavailable", { status: 503 });

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_calendar_feed`, {
    method: "POST",
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ calendar_token: token }),
    cache: "no-store",
  });
  if (!response.ok) return new Response("Calendar service unavailable", { status: 503 });

  const events = await response.json() as FeedEvent[];
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lin Pan Realty Group//Agent Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Lin Pan Realty Schedule",
    "X-PUBLISHED-TTL:PT15M",
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${event.id}@admin.linpanrealty.com`,
      `DTSTAMP:${icalDate(event.updated_at)}`,
      `DTSTART:${icalDate(event.starts_at)}`,
      `DTEND:${icalDate(event.ends_at)}`,
      `SUMMARY:${icalText(event.title)}`,
      `CATEGORIES:${icalText(event.event_type.replace("_", " ").toUpperCase())}`,
      ...(event.location ? [`LOCATION:${icalText(event.location)}`] : []),
      ...(event.notes ? [`DESCRIPTION:${icalText(event.notes)}`] : []),
      `STATUS:${event.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=lin-pan-realty-calendar.ics",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=900",
    },
  });
}

function icalDate(value: string) { return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
function icalText(value: string) { return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
