import { useEffect, useRef } from "react";

export default function Modal({ title, children, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      previousFocus?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
