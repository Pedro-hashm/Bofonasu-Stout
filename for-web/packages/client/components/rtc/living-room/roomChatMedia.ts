import { isGif, isGifBox } from "@revolt/common/lib/gifs";
import LinkifyIt from "linkify-it";
import type {
  Client,
  ImageEmbed,
  Message,
  VideoEmbed,
  WebsiteEmbed,
} from "stoat.js";

export type RoomChatMedia = {
  kind: "image" | "video";
  src: string;
  link: string;
  label: string;
  poster?: string;
};

const links = new LinkifyIt();
const webURL = (value?: string) => {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    // Malformed embeds must not prevent the chat from opening.
  }
};
const gifURL = (value: string) => /\.gif$/i.test(new URL(value).pathname);

/** Use the same media/proxy policy as normal chat, without exposing spoilers. */
export function roomChatMedia(
  message: Message,
  client: Client,
): RoomChatMedia[] {
  const media: RoomChatMedia[] = [];
  const visible = (message.content ?? "")
    .replace(/\|\|[\s\S]*?\|\|/g, "")
    .replace(/```[\s\S]*?```|`[^`]*`/g, "")
    .replace(/<https?:\/\/[^>]+>/g, "");
  const urls = new Set(
    (links.match(visible) ?? []).map((match) => webURL(match.url)),
  );
  const represented = new Set<string>();
  const add = (item: RoomChatMedia, aliases: string[] = []) => {
    if (!webURL(item.src) || !webURL(item.link)) return;
    aliases.forEach((url) => represented.add(url));
    if (media.length < 3 && !media.some((m) => m.src === item.src))
      media.push(item);
  };

  for (const file of message.attachments ?? []) {
    if (
      !file.isSpoiler &&
      (file.contentType === "image/gif" || /\.gif$/i.test(file.filename ?? ""))
    ) {
      const src = file.createFileURL(true);
      if (src)
        add({
          kind: "image",
          src: file.originalUrl,
          link: file.originalUrl,
          label: file.filename ?? "GIF",
        });
    }
  }

  for (const embed of message.embeds ?? []) {
    try {
      if (embed.type === "Website") {
        const web = embed as WebsiteEmbed;
        const aliases = [web.originalUrl, web.url]
          .map(webURL)
          .filter((url): url is string => !!url);
        if (!isGif(embed) || !aliases.some((url) => urls.has(url))) continue;
        const video = web.video;
        const image = web.image;
        const source = video ?? image;
        if (!source) continue;
        const direct = !isGifBox(embed);
        add(
          {
            kind: video ? "video" : "image",
            src: (direct ? source.url : source.proxiedURL) ?? "",
            link: aliases.find((url) => urls.has(url))!,
            label: web.title ?? "GIF",
            poster: webURL(direct ? image?.url : image?.proxiedURL),
          },
          aliases,
        );
      } else if (embed.type === "Image" || embed.type === "Video") {
        const source = embed as ImageEmbed | VideoEmbed;
        const url = webURL(source.url);
        if (!url || !urls.has(url) || !(isGif(embed) || gifURL(url))) continue;
        add(
          {
            kind: embed.type === "Video" ? "video" : "image",
            src:
              (isGif(embed) && !isGifBox(embed)
                ? source.url
                : source.proxiedURL) ?? "",
            link: url,
            label: "GIF",
          },
          [url],
        );
      }
    } catch {
      // Providers may return incomplete metadata; keep the original text link.
    }
  }

  // Direct GIFs can render immediately, while the server prepares embeds.
  for (const url of urls) {
    if (url && !represented.has(url) && gifURL(url))
      add({
        kind: "image",
        src: client.proxyFile(url) ?? "",
        link: url,
        label: "GIF",
      });
  }
  return media;
}
