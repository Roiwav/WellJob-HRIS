const crypto = require("node:crypto");

const sharp = require("sharp");

const db = require("../config/db");

const {
  uploadBuffer,
  downloadBuffer,
  removeObject,
  isStorageNotFoundError,
} = require("../services/storageService");

/*
 * ==================================================
 * WELLJOB SOLUTIONS
 * PROFILE PICTURE CONTROLLER
 * ==================================================
 *
 * Private profile pictures are stored in the
 * configured Supabase Storage private bucket.
 *
 * Files are NEVER exposed using a public bucket URL.
 * They are retrieved only through authenticated
 * backend endpoints.
 *
 * Features:
 * - Upload or replace own profile picture
 * - Retrieve a profile picture for authenticated display
 * - Remove own profile picture
 *
 * All five system roles may manage their OWN avatar:
 * SUPER_ADMIN, HR_MANAGER, HR_STAFF,
 * HR_COORDINATOR, and IT_SUPPORT.
 *
 * Authentication must be enforced in the routes
 * using the existing verifyToken middleware.
 */

const AVATAR_STORAGE_PREFIX =
  "avatars";

const AVATAR_SIZE = 512;

const MAX_INPUT_PIXELS =
  25_000_000;

const SAFE_AVATAR_FILENAME =
  /^[a-f0-9]{32}\.webp$/;

/*
 * ==================================================
 * HELPERS
 * ==================================================
 */

function getAuthenticatedUserId(req) {
  const id = Number(req.user?.id);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

function parseUserId(value) {
  const text = String(
    value ?? ""
  ).trim();

  if (!/^[1-9]\d*$/.test(text)) {
    return null;
  }

  const id = Number(text);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

function normalizeAvatarFilename(
  value
) {
  if (typeof value !== "string") {
    return null;
  }

  const filename = value.trim();

  return filename || null;
}

function isSafeAvatarFilename(
  filename
) {
  return (
    typeof filename === "string" &&
    SAFE_AVATAR_FILENAME.test(
      filename
    )
  );
}

function getAvatarObjectPath(
  filename
) {
  if (
    !isSafeAvatarFilename(
      filename
    )
  ) {
    return null;
  }

  return `${AVATAR_STORAGE_PREFIX}/${filename}`;
}

/*
 * Avatar cleanup is intentionally best-effort.
 *
 * Database state remains authoritative. Cleanup
 * errors are logged instead of turning an already
 * completed database operation into a false failure.
 */

async function deleteStoredAvatar(
  filename
) {
  const objectPath =
    getAvatarObjectPath(
      filename
    );

  if (!objectPath) {
    return;
  }

  try {
    await removeObject(
      objectPath
    );
  } catch (error) {
    if (
      !isStorageNotFoundError(
        error
      )
    ) {
      console.error(
        "AVATAR STORAGE CLEANUP ERROR:",
        error
      );
    }
  }
}

async function getActiveUser(
  userId
) {
  const [rows] =
    await db.promise().query(
      `
      SELECT
        id,
        avatar_filename
      FROM users
      WHERE id = ?
        AND UPPER(TRIM(status)) = 'ACTIVE'
      LIMIT 1
      `,
      [userId]
    );

  return rows[0] || null;
}

/*
 * ==================================================
 * UPLOAD OR REPLACE OWN PROFILE PICTURE
 * ==================================================
 *
 * Expected request:
 *
 * PUT /api/users/me/avatar
 *
 * Content-Type: multipart/form-data
 * Field name: avatar
 *
 * avatarUpload middleware stores the incoming
 * upload in memory and validates its basic type.
 *
 * The authenticated user's ID comes exclusively
 * from the verified session, NOT from req.body.
 */

exports.uploadMyAvatar =
  async (req, res) => {
    const userId =
      getAuthenticatedUserId(
        req
      );

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication is required.",
      });
    }

    if (
      !req.file ||
      !Buffer.isBuffer(
        req.file.buffer
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please select a profile picture to upload.",
      });
    }

    let newFilename = null;
    let newObjectStored = false;
    let databaseUpdated = false;

    try {
      /*
       * Verify that the authenticated account
       * still exists and is active.
       */

      const user =
        await getActiveUser(
          userId
        );

      if (!user) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              "Your account is not allowed to update a profile picture.",
          });
      }

      const previousFilename =
        normalizeAvatarFilename(
          user.avatar_filename
        );

      /*
       * Decode the image, normalize orientation,
       * resize it, and convert it to WebP.
       *
       * Metadata is not preserved.
       */

      let processedImage;

      try {
        processedImage =
          await sharp(
            req.file.buffer,
            {
              limitInputPixels:
                MAX_INPUT_PIXELS,
              failOn: "error",
              animated: false,
            }
          )
            .rotate()
            .resize(
              AVATAR_SIZE,
              AVATAR_SIZE,
              {
                fit: "cover",
                position:
                  "centre",
                withoutEnlargement:
                  true,
              }
            )
            .webp({
              quality: 82,
              effort: 4,
            })
            .toBuffer();
      } catch (_error) {
        return res
          .status(415)
          .json({
            success: false,
            message:
              "The selected file could not be processed as a valid profile picture.",
          });
      }

      /*
       * Generate a server-controlled filename.
       * Never reuse the client's original filename.
       */

      newFilename =
        `${crypto
          .randomBytes(16)
          .toString("hex")}.webp`;

      const newObjectPath =
        getAvatarObjectPath(
          newFilename
        );

      await uploadBuffer(
        newObjectPath,
        processedImage,
        {
          contentType:
            "image/webp",
          upsert: false,
        }
      );

      newObjectStored = true;

      /*
       * Update only the authenticated user's row.
       *
       * The old filename is included in the WHERE
       * clause to protect against concurrent avatar
       * replacements.
       */

      const [result] =
        await db.promise().query(
          `
          UPDATE users
          SET avatar_filename = ?
          WHERE id = ?
            AND UPPER(TRIM(status)) = 'ACTIVE'
            AND avatar_filename <=> ?
          `,
          [
            newFilename,
            userId,
            previousFilename,
          ]
        );

      if (
        Number(
          result.affectedRows
        ) !== 1
      ) {
        await deleteStoredAvatar(
          newFilename
        );

        newObjectStored =
          false;

        return res
          .status(409)
          .json({
            success: false,
            message:
              "Your profile picture changed during the upload. Please refresh and try again.",
          });
      }

      databaseUpdated = true;

      /*
       * Delete the previous cloud object only AFTER
       * the database successfully points to the new
       * avatar.
       */

      if (previousFilename) {
        await deleteStoredAvatar(
          previousFilename
        );
      }

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Profile picture updated successfully.",

          avatar_filename:
            newFilename,

          avatarFilename:
            newFilename,
        });
    } catch (error) {
      console.error(
        "UPLOAD PROFILE PICTURE ERROR:",
        error
      );

      /*
       * Compensating cleanup:
       * if cloud upload completed but the database
       * update did not, remove the orphaned object.
       */

      if (
        newObjectStored &&
        !databaseUpdated &&
        newFilename
      ) {
        await deleteStoredAvatar(
          newFilename
        );
      }

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to update your profile picture.",
        });
    }
  };

/*
 * ==================================================
 * GET PROFILE PICTURE
 * ==================================================
 *
 * Expected request:
 *
 * GET /api/users/:id/avatar
 *
 * The route must use verifyToken.
 *
 * Clients provide only a user ID.
 * The storage object path is generated by the server.
 */

exports.getAvatar =
  async (req, res) => {
    const authenticatedUserId =
      getAuthenticatedUserId(
        req
      );

    if (
      !authenticatedUserId
    ) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Authentication is required.",
        });
    }

    const targetUserId =
      parseUserId(
        req.params?.id
      );

    if (!targetUserId) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Invalid user ID.",
        });
    }

    try {
      const user =
        await getActiveUser(
          targetUserId
        );

      if (!user) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Profile picture not found.",
          });
      }

      const filename =
        normalizeAvatarFilename(
          user.avatar_filename
        );

      const objectPath =
        getAvatarObjectPath(
          filename
        );

      if (!objectPath) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Profile picture not found.",
          });
      }

      let imageBuffer;

      try {
        imageBuffer =
          await downloadBuffer(
            objectPath
          );
      } catch (error) {
        if (
          isStorageNotFoundError(
            error
          )
        ) {
          return res
            .status(404)
            .json({
              success: false,
              message:
                "Profile picture file not found.",
            });
        }

        throw error;
      }

      /*
       * Protected profile pictures must not be
       * publicly cached.
       */

      res.set({
        "Content-Type":
          "image/webp",

        "Content-Disposition":
          "inline",

        "Cache-Control":
          "private, no-store",

        "X-Content-Type-Options":
          "nosniff",
      });

      return res
        .status(200)
        .send(
          imageBuffer
        );
    } catch (error) {
      console.error(
        "GET PROFILE PICTURE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to retrieve the profile picture.",
        });
    }
  };

/*
 * ==================================================
 * REMOVE OWN PROFILE PICTURE
 * ==================================================
 *
 * Expected request:
 *
 * DELETE /api/users/me/avatar
 *
 * Users may remove only their OWN avatar.
 *
 * Database reference is cleared first so a failed
 * storage cleanup cannot leave the application
 * referencing a deleted file.
 */

exports.removeMyAvatar =
  async (req, res) => {
    const userId =
      getAuthenticatedUserId(
        req
      );

    if (!userId) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Authentication is required.",
        });
    }

    try {
      const user =
        await getActiveUser(
          userId
        );

      if (!user) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              "Your account is not allowed to remove a profile picture.",
          });
      }

      const previousFilename =
        normalizeAvatarFilename(
          user.avatar_filename
        );

      if (!previousFilename) {
        return res
          .status(200)
          .json({
            success: true,
            message:
              "Your account has no uploaded profile picture.",

            avatar_filename:
              null,

            avatarFilename:
              null,
          });
      }

      /*
       * Clear the database reference first.
       *
       * Conditional update prevents this request
       * from deleting a newer avatar selected by a
       * concurrent request.
       */

      const [result] =
        await db.promise().query(
          `
          UPDATE users
          SET avatar_filename = NULL
          WHERE id = ?
            AND UPPER(TRIM(status)) = 'ACTIVE'
            AND avatar_filename = ?
          `,
          [
            userId,
            previousFilename,
          ]
        );

      if (
        Number(
          result.affectedRows
        ) !== 1
      ) {
        return res
          .status(409)
          .json({
            success: false,
            message:
              "Your profile picture changed. Please refresh and try again.",
          });
      }

      await deleteStoredAvatar(
        previousFilename
      );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Profile picture removed successfully.",

          avatar_filename:
            null,

          avatarFilename:
            null,
        });
    } catch (error) {
      console.error(
        "REMOVE PROFILE PICTURE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Unable to remove your profile picture.",
        });
    }
  };
