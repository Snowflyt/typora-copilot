import { getLuminance } from "color2k";
import "./Switch.scss";

export interface SwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

const Switch: FC<SwitchProps> = ({ onChange, value }) => {
  const isDark = getLuminance(window.getComputedStyle(document.body).backgroundColor) < 0.5;

  // The following colors and shadows are extracted from naive-ui
  // https://www.naiveui.com/en-US/os-theme/components/switch
  const switchBackgroundColor = {
    dark: { on: "#2a947d", off: "#464649" },
    light: { on: "#18a058", off: "#dbdbdb" },
  }[isDark ? "dark" : "light"][value ? "on" : "off"];
  const toggleBoxShadow = {
    dark: "0 2px 4px 0 rgba(0, 0, 0, 40%)",
    light: "0 1px 4px 0 rgba(0, 0, 0, 30%), inset 0 0 1px 0 rgba(0, 0, 0, 5%)",
  }[isDark ? "dark" : "light"];

  return (
    <div
      class={`switch ${value ? "on" : "off"}`}
      style={{ backgroundColor: switchBackgroundColor }}
      onClick={() => {
        onChange(!value);
      }}>
      <div class="toggle" style={{ boxShadow: toggleBoxShadow }} />
    </div>
  );
};

export default Switch;
