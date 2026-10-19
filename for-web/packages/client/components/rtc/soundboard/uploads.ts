import type { SoundBackend } from "./backend";

/** Keep service failures actionable; never replace every error with a quota warning. */
export function uploadError(error: unknown, subject: string): Error {
  const e =
    error && typeof error === "object"
      ? (error as {
          message?: string;
          statusCode?: string | number;
          code?: string;
          name?: string;
        })
      : {};
  const message = typeof e.message === "string" ? e.message : "";
  const reason = `${e.code ?? ""} ${message}`.toLowerCase();
  if (reason.includes("mime") || Number(e.statusCode) === 415)
    return new Error(
      `O servidor recusou o formato informado para ${subject}. Atualize o app e tente novamente.`,
    );
  if (
    Number(e.statusCode) === 413 ||
    /maximum.*size|too large|exceeded.*size/.test(reason)
  )
    return new Error(`${subject} excede o tamanho permitido pelo servidor.`);
  if (/bucket.*not found|no such bucket/.test(reason))
    return new Error("O armazenamento ainda não foi configurado no Supabase.");
  if (
    /row.level|rls|permission|unauthorized|jwt/.test(reason) ||
    [401, 403].includes(Number(e.statusCode))
  )
    return new Error(
      "Sua sessão não tem permissão para enviar arquivos. Reconecte a biblioteca com o convite.",
    );
  if (/duplicate|already exists/.test(reason) || Number(e.statusCode) === 409)
    return new Error(
      "Este arquivo já existe. Atualize a biblioteca e tente novamente.",
    );
  if (
    /fetch|network|connection|timeout/.test(reason) ||
    e.name === "StorageUnknownError"
  )
    return new Error(
      "A conexão com o armazenamento falhou. Confira a internet e tente novamente.",
    );
  return new Error(
    `Não foi possível enviar ${subject}.${message ? ` ${message.slice(0, 240)}` : " Tente novamente."}`,
  );
}

/** Blob uploads keep File.type in multipart, ignoring contentType in storage-js.
 * Send bytes so the validated MIME is actually used, including OGGs from Firefox. */
export async function uploadBytes(
  backend: SoundBackend,
  bucket: string,
  path: string,
  file: Blob,
  mime: string,
  subject: string,
) {
  const result = await backend.storage
    .from(bucket)
    .upload(path, await file.arrayBuffer(), {
      contentType: mime,
      upsert: false,
      cacheControl: "31536000",
    });
  if (result.error) throw uploadError(result.error, subject);
}
