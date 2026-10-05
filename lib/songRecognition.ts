/**
 * Song recognition for the Discord bot's /shazam, using the official AudD API (audd.io).
 * AudD takes the raw audio file, so no scraping of anyone's private endpoint. It needs an API token
 * (AUDD_API_TOKEN); without one the command tells the user it isn't set up.
 *
 * The network call is injected as `post`, so the parsing logic can be tested without hitting AudD.
 */

export interface RecognizedSong {
  title: string;
  artist: string;
  album?: string;
  releaseDate?: string;
  label?: string;
  /** links to the song on streaming services, if AudD found them */
  links: { name: string; url: string }[];
  /** AudD's own song page / share link */
  songUrl?: string;
  artwork?: string;
}

export type RecognizeError = "notoken" | "nomatch" | "toobig" | "badfile" | "quota" | "unavailable";

const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const asStr = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Only ever hand out https links, and only from hosts we expect from AudD, so nothing user-controlled is echoed as a link. */
function safeHttps(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export interface AudDPost {
  /** POSTs multipart form-data to AudD and returns the parsed JSON (or throws on a network error) */
  (form: FormData): Promise<{ status: number; json: unknown }>;
}

export async function recognizeSong(
  file: { data: Uint8Array; filename: string },
  token: string | undefined,
  post: AudDPost
): Promise<{ ok: true; song: RecognizedSong } | { ok: false; error: RecognizeError; detail?: string }> {
  if (!token) return { ok: false, error: "notoken" };

  const form = new FormData();
  form.append("api_token", token);
  form.append("return", "apple_music,spotify,deezer");
  form.append("file", new Blob([new Uint8Array(file.data)]), file.filename || "audio");

  let res: { status: number; json: unknown };
  try {
    res = await post(form);
  } catch {
    return { ok: false, error: "unavailable" };
  }
  if (res.status === 413) return { ok: false, error: "toobig" };
  if (res.status === 429) return { ok: false, error: "quota" };
  if (res.status !== 200) return { ok: false, error: "unavailable" };

  const body = asObj(res.json);
  if (body.status === "error") {
    const err = asObj(body.error);
    const code = typeof err.error_code === "number" ? err.error_code : 0;
    // 900 = wrong/insufficient token, 901 = out of requests (see AudD docs)
    if (code === 901) return { ok: false, error: "quota" };
    if (code === 900) return { ok: false, error: "notoken" };
    if (code === 300) return { ok: false, error: "badfile" };
    return { ok: false, error: "unavailable", detail: asStr(err.error_message) };
  }

  const result = body.result;
  if (!result || typeof result !== "object") return { ok: false, error: "nomatch" };

  const r = asObj(result);
  const title = asStr(r.title), artist = asStr(r.artist);
  if (!title || !artist) return { ok: false, error: "nomatch" };

  const links: { name: string; url: string }[] = [];
  const spotifyUrl = safeHttps(asStr(asObj(asObj(r.spotify).external_urls).spotify));
  if (spotifyUrl) links.push({ name: "Spotify", url: spotifyUrl });
  const appleUrl = safeHttps(asStr(asObj(r.apple_music).url));
  if (appleUrl) links.push({ name: "Apple Music", url: appleUrl });
  const deezerUrl = safeHttps(asStr(asObj(r.deezer).link));
  if (deezerUrl) links.push({ name: "Deezer", url: deezerUrl });

  const artwork =
    safeHttps(asStr(asObj(asObj(r.apple_music).artwork).url)?.replace("{w}", "300").replace("{h}", "300")) ??
    safeHttps(asStr(asObj(asObj(asObj(r.spotify).album).images as never)));

  return {
    ok: true,
    song: {
      title,
      artist,
      album: asStr(r.album),
      releaseDate: asStr(r.release_date),
      label: asStr(r.label),
      links,
      songUrl: safeHttps(asStr(r.song_link)),
      artwork,
    },
  };
}
