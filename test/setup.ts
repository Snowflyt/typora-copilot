import { Window } from "happy-dom";

const window = new Window();
Object.assign(window, {
  isWin: false,
  dirname: "/usr/share/typora/resources",
  _options: {
    appLocale: "en",
    appVersion: "1.7.6",
  },
});
global.window = window as unknown as typeof global.window;
