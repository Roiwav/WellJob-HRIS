import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const standbySource = fs.readFileSync(
  new URL(
    "../src/components/standby/WelljobStandbyScreen.jsx",
    import.meta.url
  ),
  "utf8"
);
const standbyExperienceSource = fs.readFileSync(
  new URL(
    "../src/components/standby/StandbyExperience.jsx",
    import.meta.url
  ),
  "utf8"
);
const loginSource = fs.readFileSync(
  new URL("../src/pages/Login.jsx", import.meta.url),
  "utf8"
);

test("mobile login intro scrolls naturally and prioritizes the Enter HRIS action", () => {
  assert.match(
    standbySource,
    /overflow-x-hidden overflow-y-auto overscroll-y-contain[^"]*lg:overflow-hidden/
  );
  assert.match(standbySource, /supports-\[height:100dvh\]:min-h-dvh/);
  assert.match(standbySource, /hidden justify-center lg:order-2 lg:flex/);
  assert.match(standbySource, />\s*Enter HRIS\s*</);
  assert.match(standbySource, /onClick=\{onDismiss\}/);
  assert.match(standbySource, /env\(safe-area-inset-bottom\)/);
});

test("Enter HRIS continues to dismiss only the login intro overlay", () => {
  assert.match(standbyExperienceSource, /mode="intro"/);
  assert.match(standbyExperienceSource, /onDismiss=\{handleIntroDismiss\}/);
  assert.match(
    standbyExperienceSource,
    /setDismissedLoginVisitKey\(loginVisitKey\)/
  );
});

test("revealed login form supports dynamic viewport height and mobile scrolling", () => {
  assert.match(loginSource, /supports-\[height:100dvh\]:min-h-dvh/);
  assert.match(
    loginSource,
    /overflow-x-hidden overflow-y-auto[^"]*env\(safe-area-inset-bottom\)/
  );
  assert.match(loginSource, /aria-label=\{\s*showPassword/);
  assert.match(loginSource, /role="alert"/);
  assert.match(loginSource, /type="submit"/);
});