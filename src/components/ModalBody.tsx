export interface ModalBodyProps {
  className?: string;
  style?: preact.JSX.CSSProperties;
}

const ModalBody: FC<ModalBodyProps> = ({ children, className, style }) => {
  return (
    <div className={className} style={{ padding: "0.9rem", width: "100%", ...style }}>
      {children}
    </div>
  );
};

export default ModalBody;
