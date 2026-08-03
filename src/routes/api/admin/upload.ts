import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Unggahan gambar produk ke disk server, menggantikan Supabase Storage.
//
// Berupa route handler, bukan server function: server function menyerialkan
// argumennya sebagai JSON, sedangkan berkas biner perlu multipart/form-data.
//
// KEPUTUSAN KEAMANAN
//
// Nama berkas SELALU dibuat server dari byte acak. Nama asli dari klien tidak
// pernah dipakai, bahkan setelah dibersihkan — sanitasi nama berkas adalah
// sumber kerentanan path traversal yang tak habis-habis, dan tidak ada yang
// hilang dengan membuang namanya.
//
// Jenis berkas ditentukan dari BYTE AWALNYA, bukan dari ekstensi maupun header
// Content-Type. Keduanya dikendalikan klien; byte awal tidak.

const MAKS_BYTE = 5 * 1024 * 1024;
const MAKS_BERKAS = 10;

/** Direktori unggahan; disajikan nginx langsung, tidak lewat Node. */
const DIR_UNGGAH = process.env.UPLOAD_DIR || "/www/wwwroot/inipilihanku.com/uploads/produk";
const URL_PUBLIK = "/uploads/produk";

/**
 * Tanda tangan byte awal untuk format gambar yang diterima.
 *
 * SVG sengaja TIDAK diterima meski berupa gambar: ia dapat memuat <script>,
 * dan berkas yang disajikan dari domain yang sama dengan situs berarti skrip
 * itu berjalan dengan hak penuh halaman.
 */
const TANDA_TANGAN: { ext: string; mime: string; cocok: (b: Uint8Array) => boolean }[] = [
  {
    ext: "jpg",
    mime: "image/jpeg",
    cocok: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: "png",
    mime: "image/png",
    cocok: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d,
  },
  {
    ext: "gif",
    mime: "image/gif",
    cocok: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  },
  {
    ext: "webp",
    mime: "image/webp",
    // RIFF....WEBP
    cocok: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

function kenaliGambar(bytes: Uint8Array): { ext: string; mime: string } | null {
  return TANDA_TANGAN.find((t) => t.cocok(bytes)) ?? null;
}

async function pastikanAdmin(): Promise<{ ok: true } | { ok: false; response: Response }> {
  const { getSessionUser } = await import("@/lib/auth/session.server");
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { run } = await import("@/lib/db/pool.server");
  const rows = await run<{ ya: boolean }>("SELECT public.has_role($1, 'admin') AS ya", [user.id], {
    rls: false,
  });
  if (rows[0]?.ya !== true) {
    return { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true };
}

/** Tanpa ini, GET jatuh ke router SSR dan membalas etalase dengan status 200. */
const methodNotAllowed = () =>
  Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });

export const Route = createFileRoute("/api/admin/upload")({
  server: {
    handlers: {
      GET: methodNotAllowed,
      PUT: methodNotAllowed,
      DELETE: methodNotAllowed,
      POST: async ({ request }) => {
        const izin = await pastikanAdmin();
        if (!izin.ok) return izin.response;

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Body bukan multipart/form-data" }, { status: 400 });
        }

        const berkas = form.getAll("files").filter((f): f is File => f instanceof File);
        if (berkas.length === 0) {
          return Response.json({ error: "Tidak ada berkas" }, { status: 400 });
        }
        if (berkas.length > MAKS_BERKAS) {
          return Response.json(
            { error: `Maksimal ${MAKS_BERKAS} berkas sekali unggah` },
            { status: 400 },
          );
        }

        await mkdir(DIR_UNGGAH, { recursive: true });

        const urls: string[] = [];
        for (const f of berkas) {
          if (f.size === 0) {
            return Response.json({ error: "Berkas kosong" }, { status: 400 });
          }
          if (f.size > MAKS_BYTE) {
            return Response.json(
              { error: `Berkas melebihi ${MAKS_BYTE / 1024 / 1024} MB` },
              { status: 413 },
            );
          }

          const bytes = new Uint8Array(await f.arrayBuffer());
          const jenis = kenaliGambar(bytes);
          if (!jenis) {
            // Pesan menyebut format yang diterima, bukan apa yang terdeteksi —
            // menyebut hasil deteksi membantu penyerang memetakan pemeriksanya.
            return Response.json(
              { error: "Hanya menerima gambar JPEG, PNG, GIF, atau WebP" },
              { status: 415 },
            );
          }

          const nama = `${randomBytes(16).toString("hex")}.${jenis.ext}`;
          // mode 0644: nginx perlu membacanya, tidak ada yang perlu menjalankannya.
          await writeFile(join(DIR_UNGGAH, nama), bytes, { mode: 0o644 });
          urls.push(`${URL_PUBLIK}/${nama}`);
        }

        return Response.json({ urls });
      },
    },
  },
});
