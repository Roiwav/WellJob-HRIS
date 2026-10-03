"use strict";

const express =
  require("express");

const {
  verifyToken,
} =
  require("../middleware/authMiddleware");

const {
  getAttendanceByDate,
  saveAttendance,
  getAttendanceHistory,
  getAttendanceHistoryDetail,
  getAttendancePerformance,
  getAttendanceEvidence,
} =
  require("../controllers/attendanceController");

const {
  createAttendanceEvidenceUploadAuthorizations,
} =
  require("../controllers/storageUploadController");

const {
  finalizeAttendanceEvidenceDirectUpload,
} =
  require("../middleware/directUploadFinalizeMiddleware");

const router =
  express.Router();

function requireHrCoordinator(
  req,
  res,
  next
) {
  const role =
    String(
      req?.user?.role ||
      ""
    )
      .trim()
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        "_"
      );

  if (
    role !==
    "HR_COORDINATOR"
  ) {
    return res
      .status(403)
      .json({
        success: false,

        error:
          "Attendance is restricted to HR Coordinators.",
      });
  }

  return next();
}

router.use(
  verifyToken,
  requireHrCoordinator
);

router.post(
  "/attendance/upload-authorizations",
  createAttendanceEvidenceUploadAuthorizations
);

router.get(
  "/attendance",
  getAttendanceByDate
);

router.get(
  "/attendance/history",
  getAttendanceHistory
);

router.get(
  "/attendance/history/:id/evidence",
  getAttendanceEvidence
);

router.get(
  "/attendance/history/:id",
  getAttendanceHistoryDetail
);

router.get(
  "/attendance/performance",
  getAttendancePerformance
);

router.post(
  "/attendance",
  finalizeAttendanceEvidenceDirectUpload,
  saveAttendance
);

module.exports =
  router;