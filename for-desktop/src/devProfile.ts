import fs from "node:fs";
import path from "node:path";

import { app } from "electron";

/** Run before electron-store and the instance lock to isolate custom profiles. */
if (app.isPackaged || app.commandLine.hasSwitch("dev-profile")) {
  if (app.isPackaged) app.setName("Bofonasu Stout");
  const directory = app.isPackaged
    ? path.join(app.getPath("appData"), "Bofonasu Stout")
    : path.resolve(app.commandLine.getSwitchValue("dev-profile"));
  fs.mkdirSync(directory, { recursive: true });
  app.setPath("userData", directory);
  app.setPath("sessionData", directory);
  app.setAppLogsPath(path.join(directory, "logs"));
}
