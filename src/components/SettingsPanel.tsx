/* eslint-disable react-hooks/rules-of-hooks */
import type { Signal } from "@preact/signals";
import { useSignal } from "@preact/signals";
import { useMemo } from "preact/hooks";
import { debounce, mapValues } from "radash";
import semverGte from "semver/functions/gte";
import semverValid from "semver/functions/valid";
import { kebabCase } from "string-ts";

import { t } from "@/i18n";
import type { Settings } from "@/settings";
import { settings } from "@/settings";
import type { _Id } from "@/types/tools";
import { runCommand } from "@/utils/cli-tools";
import type { NodeRuntime } from "@/utils/node-bridge";
import {
  getAllAvailableNodeRuntimes,
  getCurrentNodeRuntime,
  setCurrentNodeRuntime,
} from "@/utils/node-bridge";
import { entriesOf, keysOf } from "@/utils/tools";

import DropdownWithInput from "./DropdownWithInput";
import ModalBody from "./ModalBody";
import ModalCloseButton from "./ModalCloseButton";
import ModalContent from "./ModalContent";
import ModalOverlay from "./ModalOverlay";
import ModalTitle from "./ModalTitle";
import ModalHeader from "./ModelHeader";
import Switch from "./Switch";
import { NodejsIcon, SettingsIcon } from "./icons";

interface SettingControl<K extends keyof Settings> {
  position: "right" | "bottom";
  component: (key: K, signal: Signal<Settings[K]>) => preact.JSX.Element;
}
type TypedSettingControl<T> = SettingControl<
  keyof { [K in keyof Settings as Settings[K] extends T ? K : never]: void }
>;

const BooleanSettingControl: TypedSettingControl<boolean> = {
  position: "right",
  component: (key, signal) => (
    <Switch
      value={signal.value}
      onChange={(value) => {
        signal.value = value;
        settings[key] = value;
      }}
    />
  ),
};

type Categories = Record<string, { [K in keyof Settings]?: SettingControl<K> }>;
const categories = {
  general: {
    disableCompletions: BooleanSettingControl,
    useInlineCompletionTextInSource: BooleanSettingControl,
    useInlineCompletionTextInPreviewCodeBlocks: BooleanSettingControl,
  },
  nodejs: {
    nodePath: {
      position: "bottom",
      component: (key, signal) => {
        const optionAuto = (() => {
          if (getAllAvailableNodeRuntimes().length === 0) return null;
          const { path, version } =
            getAllAvailableNodeRuntimes().find(({ path }) => path === "bundled") ??
            getAllAvailableNodeRuntimes()[0]!;
          return (
            `${t("settings-panel.nodejs.constant.PATH_AUTO_DETECT")} ` +
            `(${path === "bundled" ? t("settings-panel.nodejs.constant.PATH_BUNDLED") : path}, ` +
            `${version.startsWith("v") ? version : "v" + version})`
          );
        })();
        const options = [
          ...(optionAuto ? [optionAuto] : []),
          ...getAllAvailableNodeRuntimes()
            .filter(({ path }) => path !== "bundled")
            .map(
              ({ path, version }) =>
                `${path} (${version.startsWith("v") ? version : "v" + version})`,
            ),
        ];

        const currentVersion = useSignal(getCurrentNodeRuntime().version);

        const inputType = useSignal<"default" | "passed" | "failed">(
          getCurrentNodeRuntime().path === "not found" ? "failed" : "default",
        );
        const forceFocusInput = useSignal(false);
        const info = useSignal(
          getCurrentNodeRuntime().path === "not found" ?
            options.length > 0 ?
              t("settings-panel.nodejs.node-path.message.warn-empty-select-or-input")
            : t("settings-panel.nodejs.node-path.message.warn-empty-input")
          : "",
        );
        const infoColor = useSignal(
          getCurrentNodeRuntime().path === "not found" ?
            /* text-red-500 */ "#f56565"
          : /* text-blue-500 */ "#4299e1",
        );
        const dropdownMarginTop = useSignal(
          getCurrentNodeRuntime().path === "not found" ? "1.75rem" : "default",
        );

        const parseOption = (option: string): NodeRuntime => {
          const parts = option.split(" ");

          if (option === optionAuto) {
            let path = parts
              .slice(0, -1)
              .join(" ")
              .slice(t("settings-panel.nodejs.constant.PATH_AUTO_DETECT").length + 2, -1);
            if (path === t("settings-panel.nodejs.constant.PATH_BUNDLED")) path = "bundled";
            const version = parts[parts.length - 1]!.slice(0, -1);
            return { path, version };
          }

          if (parts.length < 2) return { path: option, version: "unknown" };
          const lastPart = parts[parts.length - 1];
          if (!lastPart || !lastPart.startsWith("(") || !lastPart.endsWith(")"))
            return { path: option, version: "unknown" };
          const version = lastPart.slice(1, -1);
          if (!semverValid(version)) return { path: option, version: "unknown" };
          return {
            path: parts.slice(0, -1).join(" "),
            version: version.startsWith("v") ? version : `v${version}`,
          };
        };

        const retrieveRuntimeVersion = useMemo(
          () =>
            debounce(
              { delay: 500 },
              (() => {
                let latestTimestamp = 0;

                return (path: string) => {
                  const timestamp = Date.now();
                  latestTimestamp = timestamp;

                  runCommand(`"${path}" -v`)
                    .then((output) => {
                      if (latestTimestamp !== timestamp) return;
                      const version = output.trim();
                      if (!version) throw new Error("No version found");
                      if (!semverValid(version)) throw new Error(`Invalid version: ${version}`);
                      if (semverGte(version, "20.0.0")) {
                        setCurrentNodeRuntime({ path, version });
                        settings[key] = path;
                        signal.value = path;
                        currentVersion.value = version;
                        inputType.value = "passed";
                        forceFocusInput.value = false;
                        info.value = t("settings-panel.nodejs.node-path.message.updated")
                          .replace("{{PATH}}", path)
                          .replace("{{VERSION}}", version);
                        infoColor.value = "#48bb78"; // text-green-500
                      } else {
                        inputType.value = "failed";
                        forceFocusInput.value = false;
                        info.value = t(
                          "settings-panel.nodejs.node-path.message.warn-invalid-version",
                        )
                          .replace("{{PATH}}", path)
                          .replace("{{VERSION}}", version);
                        infoColor.value = "#f56565"; // text-red-500
                      }
                    })
                    .catch(() => {
                      if (latestTimestamp !== timestamp) return;
                      inputType.value = "failed";
                      forceFocusInput.value = false;
                      info.value = t(
                        "settings-panel.nodejs.node-path.message.warn-invalid",
                      ).replace("{{PATH}}", path);
                      infoColor.value = "#f56565"; // text-red-500
                    });
                };
              })(),
            ),
          [currentVersion, key, signal, inputType, forceFocusInput, info, infoColor],
        );

        return (
          <div style={{ width: "100%", marginTop: "0.75rem" }}>
            <DropdownWithInput
              type={inputType.value}
              forceFocus={forceFocusInput.value}
              dropdownMarginTop={dropdownMarginTop.value}
              options={options}
              value={
                signal.value === null ?
                  (optionAuto ?? "")
                : signal.value +
                  (currentVersion.value === "unknown" ? "" : ` (${currentVersion.value})`)
              }
              onChange={(option) => {
                const runtime = parseOption(option);
                signal.value = option === optionAuto ? null : runtime.path;
                currentVersion.value = runtime.version;

                if (!runtime.path) {
                  inputType.value = "failed";
                  info.value =
                    options.length > 0 ?
                      t("settings-panel.nodejs.node-path.message.warn-empty-select-or-input")
                    : t("settings-panel.nodejs.node-path.message.warn-empty-input");
                  infoColor.value = "#f56565"; // text-red-500
                  dropdownMarginTop.value = "1.75rem";
                  return;
                }

                if (options.includes(option)) {
                  setCurrentNodeRuntime(runtime);
                  if (option === optionAuto) settings.clear(key);
                  else settings[key] = runtime.path;
                  inputType.value = "passed";
                  forceFocusInput.value = false;
                  info.value =
                    option === optionAuto ?
                      t("settings-panel.nodejs.node-path.message.updated-auto")
                    : t("settings-panel.nodejs.node-path.message.updated")
                        .replace("{{PATH}}", runtime.path)
                        .replace("{{VERSION}}", runtime.version);
                  infoColor.value = "#48bb78"; // text-green-500
                } else {
                  inputType.value = "default";
                  forceFocusInput.value = true;
                  info.value = t(
                    "settings-panel.nodejs.node-path.message.retrieving-version",
                  ).replace("{{PATH}}", runtime.path);
                  infoColor.value = "#4299e1"; // text-blue-500
                  dropdownMarginTop.value = "1.75rem";
                  retrieveRuntimeVersion(runtime.path);
                }
              }}
              onOpenDropdown={() => {
                if (inputType.value === "passed") inputType.value = "default";
              }}
              onCloseDropdown={() => {
                if (inputType.value === "default" && !forceFocusInput.value) info.value = "";
                dropdownMarginTop.value = "default";
              }}
            />

            {info.value && (
              <div
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.75rem",
                  lineHeight: 1,
                  color: infoColor.value,
                }}>
                {info.value}
              </div>
            )}
          </div>
        );
      },
    },
  },
} as const satisfies Categories;

const categoryIcons = {
  general: <SettingsIcon size={18} />,
  nodejs: <NodejsIcon size={18} />,
} as const satisfies Record<keyof typeof categories, preact.JSX.Element>;

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
  const signals = mapValues(categories, (category) =>
    mapValues(category as never, (_, key) => useSignal(settings[key])),
  ) as CategoriesSignals<typeof categories>;

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
                {categoryIcons[category]}
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
            {t.test(`settings-panel.${selectedCategory.value}.note`) && (
              <div style={{ fontSize: "0.75rem", lineHeight: 1, opacity: 0.75 }}>
                <span>* {t.tran(`settings-panel.${selectedCategory.value}.note`)}</span>
                <hr
                  style={{
                    height: 0,
                    margin: "1rem 0",
                    border: "none",
                    background: "transparent",
                    borderTop: "1px dashed",
                  }}
                />
              </div>
            )}
            {entriesOf(categories[selectedCategory.value]).map(([key, control], i, arr) => (
              <>
                <div key={key} style={{ width: "100%" }}>
                  {(() => {
                    if (control.position === "right")
                      return (
                        <>
                          <div
                            style={{
                              width: "100%",
                              display: "flex",
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}>
                            <span>
                              {t.tran(
                                `settings-panel.${selectedCategory.value}.${kebabCase(key)}.label`,
                              )}
                            </span>
                            {control.component(
                              key as never,
                              (signals[selectedCategory.value] as never)[key],
                            )}
                          </div>
                          <div
                            style={{
                              marginTop: "0.5rem",
                              fontSize: "0.75rem",
                              lineHeight: 1,
                              opacity: 0.75,
                            }}>
                            {t.tran(
                              `settings-panel.${selectedCategory.value}.${kebabCase(key)}.description`,
                            )}
                          </div>
                        </>
                      );
                    /* position: bottom */
                    return (
                      <>
                        <div>
                          {t.tran(
                            `settings-panel.${selectedCategory.value}.${kebabCase(key)}.label`,
                          )}
                        </div>
                        <div
                          style={{
                            marginTop: "0.5rem",
                            fontSize: "0.75rem",
                            lineHeight: 1,
                            opacity: 0.75,
                          }}>
                          {t.tran(
                            `settings-panel.${selectedCategory.value}.${kebabCase(key)}.description`,
                          )}
                        </div>
                        <div style={{ marginTop: "0.5rem" }}>
                          {control.component(
                            key as never,
                            (signals[selectedCategory.value] as never)[key],
                          )}
                        </div>
                      </>
                    );
                  })()}

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
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
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

export default SettingsPanel;
