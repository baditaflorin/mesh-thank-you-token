import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-thank-you-token",
  description: "Give a thank-you token by scanning someone's QR — gratitude leaderboard",
  accentHex: "#facc15",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
