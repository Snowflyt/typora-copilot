const ModalContent: FC = ({ children }) => {
  return (
    <div
      style={{
        backgroundColor: window.getComputedStyle(document.body).backgroundColor,
        color: window.getComputedStyle(document.body).color,
        width: "min(80ch, 120ch)",
        borderRadius: "0.5rem",
        display: "flex",
        flexDirection: "column",
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}>
      {children}
    </div>
  );
};

export default ModalContent;
