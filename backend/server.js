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
 * This file retains the current persistent HTTP +
 * Socket.IO architecture for:
 *
 * - local development
 * - temporary Render fallback
 *
 * Vercel executes the exported Express app without
 * requiring this process to own a permanent TCP
 * listener.
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


function startPersistentServer() {
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


  const server =
    app.listen(
      port,
      () => {
        console.log(
          "Database connection verified."
        );

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
 * node server.js / npm start
 *
 * Start persistent runtime.
 */
if (
  require.main ===
  module
) {
  startPersistentServer();
}


/*
 * Export the Express application as well.
 *
 * This keeps server.js safe if a deployment/runtime
 * imports it rather than executing it directly.
 */
module.exports =
  app;

module.exports
  .startPersistentServer =
  startPersistentServer;
