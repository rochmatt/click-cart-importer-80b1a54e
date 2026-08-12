import { useRef, useState } from "react";

/**
 * Buka dropdown/popover saat kursor di-hover (seperti mega menu Categories),
 * dengan jeda tenggang saat kursor berpindah dari trigger ke isi agar tidak
 * keburu tertutup. Klik & keyboard tetap jalan lewat `open`/`setOpen` bawaan.
 *
 * PENTING: pakai bersama Radix DropdownMenu `modal={false}` (Popover sudah
 * non-modal). Menu modal mengunci scroll saat terbuka → geser layout → memicu
 * loop mouseenter/leave (kedip). `onOpen` dipanggil saat hover membuka.
 */
export function useHoverMenu(onOpen?: () => void) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const openNow = () => {
    cancel();
    if (open) return;
    setOpen(true);
    onOpen?.();
  };
  const scheduleClose = () => {
    cancel();
    timer.current = setTimeout(() => setOpen(false), 160);
  };

  return {
    open,
    setOpen,
    /** Sebar di tombol trigger. */
    triggerHoverProps: { onMouseEnter: openNow, onMouseLeave: scheduleClose },
    /** Sebar di konten dropdown/popover. */
    contentHoverProps: { onMouseEnter: cancel, onMouseLeave: scheduleClose },
  };
}
