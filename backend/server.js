const path =
  require("path");


require("dotenv").config({
  path:
    path.join(
      __dirname,
      ".env"
    ),

  quiet:
    true,
});


const app =
  require("./app");

const db =
  require("./config/db");


const {
  initChatSocket,
} =
  require(
    "./services/chatSocket"
  );


/*
 * ==================================================
 * LOCAL / TEMPORARY RENDER PERSISTENT RUNTIME
 * ==================================================
 *
 * This launcher remains responsible for:
 *
 * - local npm start
 * - temporary Render fallback
 * - current Socket.IO server
 *
 * Vercel uses app.js directly and therefore does not
 * execute this persistent listener.
 */


function getServerPort() {
  const port =
    Number.parseInt(
      process.env.PORT,
      10
    );


  if (
    !Number.isInteger(
      port
    ) ||
    port <= 0 ||
    port > 65535
  ) {
    throw new Error(
      "PORT must be a valid TCP port number."
    );
  }


  return port;
}


/*
 * ==================================================
 * START PERSISTENT SERVER
 * ==================================================
 */

async function startPersistentServer() {
  const port =
    getServerPort();


  const frontendOrigin =
    String(
      process.env
        .FRONTEND_ORIGIN ||
      ""
    ).trim();


  if (
    !frontendOrigin
  ) {
    throw new Error(
      "FRONTEND_ORIGIN is required."
    );
  }


  /*
   * Persistent deployments verify Aiven before
   * opening the HTTP listener.
   *
   * app.js itself performs no startup connection
   * probe, keeping Vercel imports serverless-safe.
   */
  await db.verifyConnection();


  console.log(
    "Database connection verified."
  );


  const server =
    app.listen(
      port,
      () => {
        console.log(
          `Server running on port ${port}`
        );

        console.log(
          "WELLJOB Messenger API registered at /api/chat"
        );

        console.log(
          "WELLJOB Messenger Socket.IO initialized"
        );
      }
    );


  initChatSocket(
    server,
    frontendOrigin
  );


  return server;
}


/*
 * ==================================================
 * DIRECT EXECUTION
 * ==================================================
 */

if (
  require.main ===
  module
) {
  startPersistentServer()
    .catch(
      (error) => {
        console.error(
          "SERVER STARTUP FAILED:",
          error
        );

        process.exitCode =
          1;
      }
    );
}


/*
 * Keep server.js import-safe.
 */

module.exports =
  app;

module.exports
  .startPersistentServer =
  startPersistentServer;
