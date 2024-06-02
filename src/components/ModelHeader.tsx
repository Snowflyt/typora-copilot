const ModalHeader: FC = ({ children }) => {
  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          padding: "1.4rem",
        }}>
        {children}
      </div>
      <hr style={{ margin: 0, width: "100%" }} />
    </>
  );
};

export default ModalHeader;
