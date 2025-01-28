import { darken, getLuminance, lighten } from "color2k";
import { useRef, useState } from "preact/hooks";

import "./DropdownWithInput.scss";

export interface DropdownWithInputProps {
  options: string[];

  value: string;
  onChange: (option: string) => void;

  onOpenDropdown?: () => void;
  onCloseDropdown?: () => void;

  type?: "default" | "passed" | "failed";
  forceFocus?: boolean;
  placeholder?: string;
  dropdownMarginTop?: string;
}

const DropdownWithInput: FC<DropdownWithInputProps> = ({
  dropdownMarginTop = "0.375rem",
  forceFocus = false,
  onChange,
  onCloseDropdown,
  onOpenDropdown,
  options,
  placeholder,
  type = "default",
  value,
}) => {
  const backgroundColor = window.getComputedStyle(document.body).backgroundColor;

  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<string[]>(options);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleOptionClick = (option: string) => {
    onChange(option); // Set the selected value
    setIsOpen(false); // Close the dropdown
    onCloseDropdown?.();
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!dropdownRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false); // Close dropdown on blur
      onCloseDropdown?.();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = (e.target! as unknown as { value: string }).value;
    onChange(inputValue);
    setFilteredOptions(
      options.filter((option) => option.toLowerCase().includes(inputValue.toLowerCase())),
    ); // Filter options based on input
    setIsOpen(true); // Open dropdown if user is typing
    onOpenDropdown?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setIsOpen(false); // Close dropdown when pressing Enter
      onCloseDropdown?.();
    }
  };

  return (
    <div
      ref={dropdownRef}
      className={
        "dropdown-with-input" +
        (type === "default" ? "" : ` ${type}`) +
        (forceFocus ? " focus" : "")
      }
      style={{ position: "relative", width: "100%" }}
      tabIndex={0} // Allow the div to gain focus
      onBlur={handleBlur}>
      {/* Input Field */}
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown} // Handle Enter key
        placeholder={placeholder}
        style={{ width: "100%" }}
        onFocus={() => {
          setIsOpen(true); // Open dropdown when input is focused
          onOpenDropdown?.();
          setFilteredOptions(options); // Reset filtered options on focus
        }}
      />

      {/* Dropdown Menu */}
      {isOpen && filteredOptions.length > 0 && (
        <ul
          style={{
            marginTop: dropdownMarginTop === "default" ? "0.375rem" : dropdownMarginTop,
            backgroundColor,
          }}>
          {filteredOptions.map((option, index) => (
            <li
              key={index}
              onClick={() => handleOptionClick(option)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  getLuminance(backgroundColor) > 0.5 ?
                    darken(backgroundColor, 0.05)
                  : lighten(backgroundColor, 0.05);
              }}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DropdownWithInput;
