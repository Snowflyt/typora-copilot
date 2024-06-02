import { createPortal } from "preact/compat";
import "./ModalOverlay.scss";

export interface ModalOverlayProps {
  onClose?: () => void;
}

const ModalOverlay: FC<ModalOverlayProps> = ({ children, onClose }) => {
  return createPortal(
    <div class="modal-overlay" onClick={onClose}>
      {children}
    </div>,
    document.body,
  );
};

export default ModalOverlay;
