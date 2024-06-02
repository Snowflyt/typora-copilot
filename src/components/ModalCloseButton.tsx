import "./ModalCloseButton.scss";

export interface ModalCloseButtonProps {
  onClick?: () => void;
}

const ModalCloseButton: FC<ModalCloseButtonProps> = ({ onClick }) => {
  return (
    <button type="button" className="unset-button modal-close-button" onClick={onClick}>
      ✖
    </button>
  );
};

export default ModalCloseButton;
