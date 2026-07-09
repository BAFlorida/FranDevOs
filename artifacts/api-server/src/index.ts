import app from "./app";
import { logger } from "./lib/logger";
import { ensurePermissionBootstrap } from "./lib/permissions";
import { ensureSuperAdmin } from "./lib/superAdminBootstrap";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  try {
    await ensurePermissionBootstrap();
    logger.info("Permission catalog bootstrap complete");
    await ensureSuperAdmin();
    logger.info("Super admin bootstrap complete");
  } catch (err) {
    logger.error({ err }, "Failed to bootstrap permissions / super admin");
    process.exit(1);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

void start();
