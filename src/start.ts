import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  // Internal /lovable/* routes authenticate themselves — never wrap or redirect them.
  if (new URL(request.url).pathname.startsWith("/lovable/")) {
    return next();
  }
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});


// attachSupabaseAuth DIHAPUS. Ia melampirkan header Authorization berisi JWT
// Supabase pada setiap pemanggilan server function. Setelah cutover, identitas
// dibawa cookie sesi httpOnly yang dikirim browser sendiri — tidak ada lagi
// yang perlu dilampirkan.
//
// Itu membuat csrfMiddleware di bawah menjadi WAJIB, bukan sekadar praktik
// baik: header harus disertakan secara sengaja oleh kode halaman, sedangkan
// cookie ikut terkirim pada permintaan lintas situs mana pun.
export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
