import { useSignal } from "@preact/signals";
import { mapValues } from "radash";
import { kebabCase } from "string-ts";

import ModalBody from "./ModalBody";
import ModalCloseButton from "./ModalCloseButton";
import ModalContent from "./ModalContent";
import ModalOverlay from "./ModalOverlay";
import ModalTitle from "./ModalTitle";
import ModalHeader from "./ModelHeader";
import Switch from "./Switch";

import type { Settings } from "@/settings";
import type { _Id } from "@/types/tools";
import type { Signal } from "@preact/signals";

import { t } from "@/i18n";
import { settings } from "@/settings";
import { entriesOf, keysOf } from "@/utils/tools";

type SettingControl<K extends keyof Settings> = (
  key: K,
  signal: Signal<Settings[K]>,
) => preact.JSX.Element;
type TypedSettingControl<T> = SettingControl<
  keyof { [K in keyof Settings as Settings[K] extends T ? K : never]: void }
>;

const BooleanSettingControl: TypedSettingControl<boolean> = (key, signal) => (
  <Switch
    value={signal.value}
    onChange={(value) => {
      signal.value = value;
      settings[key] = value;
    }}
  />
);

type Categories = Record<string, { [K in keyof Settings]: SettingControl<K> }>;
const categories = {
  general: {
    disableCompletions: BooleanSettingControl,
    useInlineCompletionTextInSource: BooleanSettingControl,
    useInlineCompletionTextInPreviewCodeBlocks: BooleanSettingControl,
  },
} as const satisfies Categories;

type CategoriesSignals<C extends Categories> = _Id<{
  [K in keyof C]: {
    [P in keyof C[K]]: C[K][P] extends SettingControl<infer K> ? Signal<Settings[K]> : never;
  };
}>;

export interface SettingsPanelProps {
  open?: boolean;
  onClose?: () => void;
}

const SettingsPanel: FC<SettingsPanelProps> = ({ onClose }) => {
  const selectedCategory = useSignal(Object.keys(categories)[0] as keyof typeof categories);
  const signals: CategoriesSignals<typeof categories> = mapValues(categories, (category) =>
    mapValues(category, (_, key) => useSignal(settings[key])),
  );

  return (
    <ModalOverlay onClose={onClose}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{t("settings-panel.title")}</ModalTitle>
          <ModalCloseButton onClick={onClose} />
        </ModalHeader>
        <ModalBody style={{ paddingTop: "1rem", display: "flex", flexDirection: "row" }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
            {keysOf(categories).map((category, i, arr) => (
              <MenuButton
                key={category}
                selected={selectedCategory.value === category}
                onClick={() => {
                  selectedCategory.value = category;
                }}
                style={{ marginBottom: i === arr.length - 1 ? "0" : "0.5rem" }}>
                <SettingsIcon size={18} />
                <span style={{ marginLeft: "0.375rem" }}>
                  {t(`settings-panel.${category}.title`)}
                </span>
              </MenuButton>
            ))}
          </div>

          <div
            style={{
              paddingLeft: "2rem",
              paddingRight: "1rem",
              paddingTop: "0.25rem",
              paddingBottom: "1rem",
              fontSize: "0.875rem",
              width: "100%",
              display: "flex",
              flexDirection: "column",
            }}>
            {entriesOf(categories[selectedCategory.value]).map(([key, control], i, arr) => (
              <>
                <div key={key} style={{ width: "100%" }}>
                  <div
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}>
                    <span>
                      {t(`settings-panel.${selectedCategory.value}.${kebabCase(key)}.label`)}
                    </span>
                    {control(key, signals[selectedCategory.value][key])}
                  </div>
                  <div
                    style={{
                      marginTop: "0.5rem",
                      fontSize: "0.75rem",
                      lineHeight: 1,
                      opacity: 0.75,
                    }}>
                    {t(`settings-panel.${selectedCategory.value}.${kebabCase(key)}.description`)}
                  </div>
                  {t.test(`settings-panel.${selectedCategory.value}.${kebabCase(key)}.warning`) && (
                    <div
                      style={{
                        marginTop: "0.5rem",
                        fontSize: "0.75rem",
                        lineHeight: 1,
                        color: "#ef4444",
                      }}>
                      {t.tran(`settings-panel.${selectedCategory.value}.${kebabCase(key)}.warning`)}
                    </div>
                  )}
                </div>

                {i !== arr.length - 1 && (
                  <hr style={{ width: "100%", margin: "1.375rem 0 1rem 0" }} />
                )}
              </>
            ))}
          </div>
        </ModalBody>
      </ModalContent>
    </ModalOverlay>
  );
};

const MenuButton: FC<{
  selected?: boolean;
  onClick?: () => void;
  style?: preact.JSX.CSSProperties;
}> = ({ children, onClick, selected = false, style: additionalStyle }) => {
  const style: preact.JSX.CSSProperties = {
    width: "100%",
    fontSize: "0.875rem",
    height: "fit-content",
    paddingTop: "0.25rem",
    paddingBottom: "0.25rem",
    paddingLeft: "0.5rem",
    paddingRight: "0.75rem",
    borderRadius: "0.5rem",
    display: "flex",
    whiteSpace: "nowrap",
    alignItems: "center",
    justifyContent: "flex-start",
    cursor: selected ? "default" : "pointer",
    backgroundColor: selected ? "var(--item-hover-bg-color)" : "transparent",
    ...(selected ? { pointerEvents: "none" } : {}),
    ...additionalStyle,
  };
  return selected ?
      <button className="unset-button" style={style} disabled>
        {children}
      </button>
    : <button type="button" className="unset-button" style={style} onClick={onClick}>
        {children}
      </button>;
};

const SettingsIcon: FC<{ size?: number }> = ({ size = 24 }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M3.34 17a10.017 10.017 0 0 1-.979-2.326a3 3 0 0 0 .003-5.347a9.99 9.99 0 0 1 2.5-4.337a3 3 0 0 0 4.632-2.674a9.99 9.99 0 0 1 5.007.003a3 3 0 0 0 4.632 2.671a10.056 10.056 0 0 1 2.503 4.336a3 3 0 0 0-.002 5.347a9.99 9.99 0 0 1-2.501 4.337a3 3 0 0 0-4.632 2.674a9.99 9.99 0 0 1-5.007-.002a3 3 0 0 0-4.631-2.672A10.018 10.018 0 0 1 3.339 17m5.66.196a4.992 4.992 0 0 1 2.25 2.77c.499.047 1 .048 1.499.002a4.993 4.993 0 0 1 2.25-2.772a4.993 4.993 0 0 1 3.526-.564c.29-.408.54-.843.748-1.298A4.993 4.993 0 0 1 18 12c0-1.26.47-2.437 1.273-3.334a8.152 8.152 0 0 0-.75-1.298A4.993 4.993 0 0 1 15 6.804a4.993 4.993 0 0 1-2.25-2.77c-.5-.047-1-.048-1.5-.001A4.993 4.993 0 0 1 9 6.804a4.993 4.993 0 0 1-3.526.564c-.29.408-.54.843-.747 1.298A4.993 4.993 0 0 1 6 12c0 1.26-.471 2.437-1.273 3.334a8.16 8.16 0 0 0 .75 1.298A4.993 4.993 0 0 1 9 17.196M12 15a3 3 0 1 1 0-6a3 3 0 0 1 0 6m0-2a1 1 0 1 0 0-2a1 1 0 0 0 0 2"
      />
    </svg>
  );
};

export default SettingsPanel;
