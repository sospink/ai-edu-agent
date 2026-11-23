import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// 独立课程不引用平台构建目录；Portal 与原生 dialog 提供全屏遮罩、焦点圈定及返回焦点。
export function Overlay({
  title,
  closeLabel,
  onClose,
  children,
  drawer = false,
  wide = false,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  drawer?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={`${drawer ? "drawer" : "modal"} ${wide ? "wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="overlay-head">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon"
          title={closeLabel}
          aria-label={closeLabel}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div className="overlay-body">{children}</div>
    </dialog>,
    document.body,
  );
}
