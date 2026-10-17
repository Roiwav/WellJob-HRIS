const fs = require("fs");
const path = require("path");

/*
 * ============================================================
 * WELLJOB HRIS
 * INCIDENT PHONE CAMERA — ENDPOINT CONTRACT QA
 * ROBUST WHITESPACE VERSION
 * ============================================================
 *
 * READ-ONLY STATIC QA.
 *
 * This script does NOT:
 * - start the backend server
 * - call production APIs
 * - create/cancel/consume capture sessions
 * - modify the database
 * - modify source files
 *
 * It verifies that the current frontend/backend source files
 * agree on the Incident phone-camera endpoint contract.
 *
 * RUN FROM PROJECT ROOT:
 *
 *   node backend/database/run_incident_phone_capture_contract_qa.js
 */

const PROJECT_ROOT =
  path.resolve(
    __dirname,
    "../.."
  );

const FILES = {
  routes:
    path.join(
      PROJECT_ROOT,
      "backend",
      "routes",
      "incidentRoutes.js"
    ),

  controller:
    path.join(
      PROJECT_ROOT,
      "backend",
      "controllers",
      "incidentPhoneCaptureController.js"
    ),

  client:
    path.join(
      PROJECT_ROOT,
      "frontend",
      "src",
      "utils",
      "incidents",
      "incidentPhoneCapture.js"
    ),

  phonePage:
    path.join(
      PROJECT_ROOT,
      "frontend",
      "src",
      "pages",
      "IncidentPhoneCapture.jsx"
    ),

  app:
    path.join(
      PROJECT_ROOT,
      "frontend",
      "src",
      "App.jsx"
    ),
};

let failures =
  0;

let warnings =
  0;


function printSection(
  title
) {
  console.log(
    "\n============================================================"
  );

  console.log(
    title
  );

  console.log(
    "============================================================"
  );
}


function pass(
  message
) {
  console.log(
    `PASS: ${message}`
  );
}


function fail(
  message
) {
  failures +=
    1;

  console.error(
    `FAIL: ${message}`
  );
}


function warn(
  message
) {
  warnings +=
    1;

  console.warn(
    `WARN: ${message}`
  );
}


function readRequiredFile(
  label,
  filePath
) {
  if (
    !fs.existsSync(
      filePath
    )
  ) {
    fail(
      `${label} not found: ${filePath}`
    );

    return "";
  }

  pass(
    `${label} found`
  );

  return fs.readFileSync(
    filePath,
    "utf8"
  );
}


function assertContains(
  source,
  expected,
  label
) {
  if (
    source.includes(
      expected
    )
  ) {
    pass(
      label
    );

    return true;
  }

  fail(
    `${label} — missing expected source text: ${expected}`
  );

  return false;
}


function assertNotContains(
  source,
  unexpected,
  label
) {
  if (
    !source.includes(
      unexpected
    )
  ) {
    pass(
      label
    );

    return true;
  }

  fail(
    `${label} — unexpected source text found: ${unexpected}`
  );

  return false;
}


function assertRegex(
  source,
  pattern,
  label
) {
  if (
    pattern.test(
      source
    )
  ) {
    pass(
      label
    );

    return true;
  }

  fail(
    `${label} — source pattern was not found`
  );

  return false;
}


function escapeRegex(
  value
) {
  return String(
    value
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}


function assertFetchUsesCredentialsOmit({
  source,
  urlExpression,
  method,
  label,
}) {
  const urlPattern =
    escapeRegex(
      urlExpression
    );

  const methodPattern =
    escapeRegex(
      method
    );

  const pattern =
    new RegExp(
      [
        "fetch\\s*\\(",
        "\\s*",
        urlPattern,
        "\\s*,",
        "\\s*\\{",
        "[\\s\\S]*?",
        "method\\s*:\\s*",
        `"${methodPattern}"`,
        "[\\s\\S]*?",
        "credentials\\s*:\\s*",
        '"omit"',
      ].join(
        ""
      )
    );

  assertRegex(
    source,
    pattern,
    label
  );
}


printSection(
  "1. REQUIRED SOURCE FILES"
);

const routesSource =
  readRequiredFile(
    "Incident routes",
    FILES.routes
  );

const controllerSource =
  readRequiredFile(
    "Phone capture controller",
    FILES.controller
  );

const clientSource =
  readRequiredFile(
    "Frontend phone capture client",
    FILES.client
  );

const phonePageSource =
  readRequiredFile(
    "Public phone capture page",
    FILES.phonePage
  );

const appSource =
  readRequiredFile(
    "Frontend App routes",
    FILES.app
  );


printSection(
  "2. BACKEND PUBLIC ROUTE CONTRACT"
);

assertContains(
  routesSource,
  '"/incident-evidence/phone-capture/status"',
  "Public status route exists"
);

assertContains(
  routesSource,
  '"/incident-evidence/phone-capture/upload-authorization"',
  "Public upload-authorization route exists"
);

assertContains(
  routesSource,
  '"/incident-evidence/phone-capture/complete"',
  "Public complete route exists"
);

assertNotContains(
  routesSource,
  '"/incident-evidence/phone-capture/:token"',
  "No raw capture-token route parameter remains"
);

assertNotContains(
  routesSource,
  '"/incident-evidence/phone-capture/status/:token"',
  "Status route does not place token in URL path"
);

assertNotContains(
  routesSource,
  '"/incident-evidence/phone-capture/upload-authorization/:token"',
  "Upload authorization route does not place token in URL path"
);

assertNotContains(
  routesSource,
  '"/incident-evidence/phone-capture/complete/:token"',
  "Complete route does not place token in URL path"
);


printSection(
  "3. BACKEND DESKTOP ROUTE CONTRACT"
);

assertContains(
  routesSource,
  '"/incident-evidence/phone-capture-sessions"',
  "Desktop create-session route exists"
);

assertContains(
  routesSource,
  '"/incident-evidence/phone-capture-sessions/:sessionId"',
  "Desktop session status/cancel route exists"
);

assertContains(
  routesSource,
  '"/incident-evidence/phone-capture-sessions/:sessionId/consume"',
  "Desktop consume route exists"
);


printSection(
  "4. BACKEND TOKEN TRANSPORT / STATUS CONTRACT"
);

assertContains(
  controllerSource,
  "req.body?.captureToken",
  "Public controller reads captureToken from request body"
);

assertNotContains(
  controllerSource,
  "req.params.token",
  "Public controller does not read raw token from URL params"
);

[
  "WAITING",
  "UPLOAD_AUTHORIZED",
  "UPLOADED",
  "CONSUMED",
  "CANCELLED",
].forEach(
  (
    status
  ) => {
    assertContains(
      controllerSource,
      status,
      `Controller recognizes database status ${status}`
    );
  }
);

[
  '"READY_FOR_UPLOAD"',
  '"PHOTO_ADDED"',
  '"DONE"',
  '"EXPIRED"',
].forEach(
  (
    publicStatus
  ) => {
    assertContains(
      controllerSource,
      publicStatus,
      `Controller exposes frontend status ${publicStatus}`
    );
  }
);


printSection(
  "5. FRONTEND PUBLIC API CONTRACT"
);

assertContains(
  clientSource,
  "`${PHONE_CAPTURE_PUBLIC_URL}/status`",
  "Frontend calls static public status endpoint"
);

assertContains(
  clientSource,
  "`${PHONE_CAPTURE_PUBLIC_URL}/upload-authorization`",
  "Frontend calls static public upload-authorization endpoint"
);

assertContains(
  clientSource,
  "`${PHONE_CAPTURE_PUBLIC_URL}/complete`",
  "Frontend calls static public complete endpoint"
);

assertNotContains(
  clientSource,
  "${PHONE_CAPTURE_PUBLIC_URL}/${",
  "Frontend does not interpolate raw capture token into public backend URL"
);

assertContains(
  clientSource,
  "captureToken:",
  "Frontend sends capture token in JSON body"
);

assertFetchUsesCredentialsOmit({
  source:
    clientSource,
  urlExpression:
    "`${PHONE_CAPTURE_PUBLIC_URL}/status`",
  method:
    "POST",
  label:
    "Public status request explicitly uses credentials: omit",
});

assertFetchUsesCredentialsOmit({
  source:
    clientSource,
  urlExpression:
    "`${PHONE_CAPTURE_PUBLIC_URL}/upload-authorization`",
  method:
    "POST",
  label:
    "Public upload-authorization request explicitly uses credentials: omit",
});

assertFetchUsesCredentialsOmit({
  source:
    clientSource,
  urlExpression:
    "signedUrl",
  method:
    "PUT",
  label:
    "Signed Supabase PUT explicitly uses credentials: omit",
});

assertFetchUsesCredentialsOmit({
  source:
    clientSource,
  urlExpression:
    "`${PHONE_CAPTURE_PUBLIC_URL}/complete`",
  method:
    "POST",
  label:
    "Public complete request explicitly uses credentials: omit",
});

assertNotContains(
  clientSource,
  "authenticatedFetch(\n      `${PHONE_CAPTURE_PUBLIC_URL}",
  "Public phone endpoints do not use authenticatedFetch"
);


printSection(
  "6. QR / PUBLIC PAGE CONTRACT"
);

assertContains(
  clientSource,
  '#capture=${encodeURIComponent(',
  "QR capture token is placed in frontend URL fragment"
);

assertRegex(
  clientSource,
  /params\s*\.\s*get\s*\(\s*"capture"\s*\)/,
  "Frontend reads capture token from URL fragment"
);

assertContains(
  appSource,
  'path="/incident-photo-capture"',
  "Public phone capture route is registered"
);

assertContains(
  appSource,
  'import("./pages/IncidentPhoneCapture")',
  "Phone capture page is lazy-loaded"
);

assertContains(
  phonePageSource,
  'capture="environment"',
  "Phone page requests rear/environment camera"
);

assertContains(
  phonePageSource,
  'accept="image/jpeg,image/png,.jpg,.jpeg,.png"',
  "Phone page accepts JPEG/PNG only"
);

assertContains(
  phonePageSource,
  "MAX_PHONE_IMAGE_SIZE",
  "Phone page applies local image-size validation"
);


printSection(
  "7. FRONTEND STATUS CONTRACT"
);

[
  "WAITING",
  "READY_FOR_UPLOAD",
  "PHOTO_ADDED",
  "DONE",
  "CANCELLED",
  "EXPIRED",
].forEach(
  (
    status
  ) => {
    assertContains(
      clientSource,
      `${status}:`,
      `Frontend status constant ${status} exists`
    );
  }
);


printSection(
  "8. SECURITY / LOGGING GUARDRAILS"
);

assertNotContains(
  clientSource,
  "?captureToken=",
  "Frontend does not place capture token in backend query string"
);

assertNotContains(
  controllerSource,
  "console.log(captureToken",
  "Controller does not directly log raw capture token"
);

assertNotContains(
  controllerSource,
  "console.log(token",
  "Controller does not directly log generic raw token variable"
);

if (
  /verifyToken[\s\S]{0,250}phone-capture\/status/.test(
    routesSource
  ) ||
  /verifyToken[\s\S]{0,250}phone-capture\/upload-authorization/.test(
    routesSource
  ) ||
  /verifyToken[\s\S]{0,250}phone-capture\/complete/.test(
    routesSource
  )
) {
  warn(
    "verifyToken appears near a public phone route in source. Manually confirm public status/upload/complete routes do not include verifyToken middleware."
  );
} else {
  pass(
    "No verifyToken middleware appears immediately adjacent to public phone routes"
  );
}


printSection(
  "9. QA SUMMARY"
);

console.log(
  `Failures: ${failures}`
);

console.log(
  `Warnings: ${warnings}`
);

if (
  failures >
  0
) {
  console.error(
    "\nCONTRACT_QA_RESULT=FAIL"
  );

  process.exitCode =
    1;
} else {
  console.log(
    "\nCONTRACT_QA_RESULT=PASS"
  );

  if (
    warnings >
    0
  ) {
    console.log(
      "Review warning(s) above before live end-to-end testing."
    );
  } else {
    console.log(
      "Frontend and backend Incident phone-camera contracts are statically aligned."
    );
  }
}