import "./Switch.scss";

export interface SwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

const Switch: FC<SwitchProps> = ({ onChange, value }) => {
  return (
    <div class={`switch ${value ? "on" : "off"}`} onClick={() => onChange(!value)}>
      <div class="toggle" />
    </div>
  );
};

export default Switch;
