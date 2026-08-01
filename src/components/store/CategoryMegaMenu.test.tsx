import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { CategoryMegaMenu } from "@/components/store/CategoryMegaMenu";

// The mega menu only needs Link for markup; a plain anchor keeps the test
// free of router context while preserving accessible semantics.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params, children, ...rest }: any) => (
    <a href={typeof to === "string" ? to : "#"} data-params={JSON.stringify(params)} {...rest}>
      {children}
    </a>
  ),
}));

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

  it("selects a quick link and returns focus to the trigger", async () => {
    const { user, trigger, onQueryChange } = setup();
    await openMenu(user);
    const panel = screen.getByRole("tabpanel");
    const link = within(panel).getByRole("button", { name: "Sneakers" });
    await user.click(link);
    expect(onQueryChange).toHaveBeenCalledWith("Sneakers");
    expect(trigger).toHaveFocus();
  });

  it("labels navigation groups and featured products for screen readers", async () => {
    const { user, trigger } = setup();
    await openMenu(user);
    expect(screen.getByRole("navigation", { name: /Fashion — Men/ })).toBeInTheDocument();
    const featuredHeading = screen.getByRole("heading", { name: /Featured in Fashion/i });
    expect(featuredHeading).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /Featured in Fashion/i })).toBeInTheDocument();
    // featured thumbnails are decorative
    document
      .querySelectorAll("img")
      .forEach((img) => expect(img).toHaveAttribute("alt", ""));
  });
});
