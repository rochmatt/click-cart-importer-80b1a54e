import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryMegaMenu } from "@/components/store/CategoryMegaMenu";

// Router ditiru sebagian: yang diuji berkas ini adalah semantik dan perilaku
// papan ketik, bukan perutean.
//
// KENAPA MENYEBAR importOriginal, BUKAN MENDAFTAR EKSPOR SATU-SATU. Versi
// sebelumnya hanya menyediakan Link. Ketika komponen mulai memanggil
// useNavigate, nilainya menjadi undefined dan SELURUH berkas ini gagal saat
// render — sepuluh tes sekaligus, dengan pesan yang menunjuk baris useNavigate
// di komponen alih-alih mock yang tertinggal di sini. Penyebabnya tidak terbaca
// dari laporan tes, dan kegagalannya bertahan lama justru karena terlihat
// seperti masalah komponen.
//
// Dengan menyebar modul aslinya, ekspor yang belum terpikirkan tetap terisi.
// Hanya dua yang benar-benar perlu diganti: Link supaya tidak menuntut konteks
// router, dan useNavigate supaya tujuan navigasinya bisa diperiksa.
//
// vi.hoisted dipakai karena factory vi.mock diangkat ke atas seluruh impor;
// merujuk const biasa dari dalamnya akan melempar "cannot access before
// initialization".
const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

/**
 * Props Link yang ditiru. to dan params bertipe unknown karena Link asli
 * menerima objek rute bertipe ketat yang tidak berarti apa-apa di sini — yang
 * dibutuhkan tes hanyalah anchor dengan href yang masuk akal.
 */
type PropsLinkTiruan = ComponentProps<"a"> & { to?: unknown; params?: unknown };

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  // Anchor biasa: menjaga semantik yang diperiksa axe tanpa konteks router.
  Link: ({ to, params, children, ...rest }: PropsLinkTiruan) => (
    <a href={typeof to === "string" ? to : "#"} data-params={JSON.stringify(params)} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
}));

beforeEach(() => {
  navigate.mockClear();
});

function setup() {
  const onQueryChange = vi.fn();
  const user = userEvent.setup();
  render(<CategoryMegaMenu onQueryChange={onQueryChange} />);
  const trigger = screen.getByRole("button", { name: /categories/i });
  return { user, trigger, onQueryChange };
}

const tabs = () => screen.getAllByRole("tab");

// hover opens the menu, so drive it via the keyboard for deterministic state
async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  screen.getByRole("button", { name: /categories/i }).focus();
  await user.keyboard("{Enter}");
}

describe("CategoryMegaMenu accessibility", () => {
  it("has no axe violations when closed", async () => {
    const { container } = render(<CategoryMegaMenu onQueryChange={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no axe violations when open", async () => {
    const user = userEvent.setup();
    const { container } = render(<CategoryMegaMenu onQueryChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /categories/i }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("exposes correct trigger and tablist semantics", async () => {
    const { user, trigger } = setup();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls");

    await openMenu(user);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const tablist = screen.getByRole("tablist", { name: /category groups/i });
    expect(tablist).toHaveAttribute("aria-orientation", "vertical");

    const panel = screen.getByRole("tabpanel");
    const selectedTab = tabs().find((t) => t.getAttribute("aria-selected") === "true")!;
    expect(panel).toHaveAttribute("aria-labelledby", selectedTab.id);
    expect(selectedTab).toHaveAttribute("aria-controls", panel.id);
  });

  it("uses roving tabindex on the tabs", async () => {
    const { user, trigger } = setup();
    await openMenu(user);
    const selected = tabs().filter((t) => t.getAttribute("tabindex") === "0");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAttribute("aria-selected", "true");
  });

  it("opens with Enter and focuses the first category tab", async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(tabs()[0]).toHaveFocus();
  });

  it("moves between tabs with arrow, Home and End keys", async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const all = tabs();
    expect(all[0]).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(tabs()[1]).toHaveFocus();
    expect(tabs()[1]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowUp}");
    expect(tabs()[0]).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(tabs()[all.length - 1]).toHaveFocus();

    await user.keyboard("{Home}");
    expect(tabs()[0]).toHaveFocus();

    await user.keyboard("{End}");
    expect(tabs()[all.length - 1]).toHaveFocus();
  });

  it("moves focus into the panel with ArrowRight", async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard("{Enter}{ArrowRight}");
    const panel = screen.getByRole("tabpanel");
    expect(panel).toContainElement(document.activeElement as HTMLElement);
  });

  it("closes with Escape and returns focus to the trigger", async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("selects a quick link, navigates to search and returns focus to the trigger", async () => {
    const { user, trigger, onQueryChange } = setup();
    await openMenu(user);
    const panel = screen.getByRole("tabpanel");
    const link = within(panel).getByRole("button", { name: "Sneakers" });
    await user.click(link);

    expect(onQueryChange).toHaveBeenCalledWith("Sneakers");
    // Tujuan navigasinya ikut diperiksa. Tanpa ini, memanggil useNavigate tetap
    // tidak teruji sama sekali — dan justru pemanggilan itulah yang selama ini
    // menjatuhkan seluruh berkas tanpa ada yang memeriksa apakah tujuannya benar.
    expect(navigate).toHaveBeenCalledWith({ to: "/search", search: { q: "Sneakers" } });
    expect(trigger).toHaveFocus();
  });

  it("tidak menavigasi saat menu hanya dibuka dan ditutup", async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard("{Enter}{Escape}");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("mock meneruskan ekspor router lain dari modul asli", async () => {
    // Penjaga terhadap kegagalan yang sama terulang. Tanpa tes ini, mock yang
    // gagal menyebar modul asli akan tetap meloloskan semua tes di atas — sebab
    // hanya Link dan useNavigate yang dipakai — lalu menjatuhkan sepuluh tes
    // sekaligus pada hari komponen memakai satu API router lagi.
    const router = await import("@tanstack/react-router");
    expect(typeof router.useRouter).toBe("function");
    expect(typeof router.useSearch).toBe("function");
    expect(Object.keys(router).length).toBeGreaterThan(50);
  });

  it("labels navigation groups and featured products for screen readers", async () => {
    const { user, trigger } = setup();
    await openMenu(user);
    expect(screen.getByRole("navigation", { name: /Fashion — Men/ })).toBeInTheDocument();
    const featuredHeading = screen.getByRole("heading", { name: /Featured in Fashion/i });
    expect(featuredHeading).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /Featured in Fashion/i })).toBeInTheDocument();
    // featured thumbnails are decorative
    document.querySelectorAll("img").forEach((img) => expect(img).toHaveAttribute("alt", ""));
  });
});
