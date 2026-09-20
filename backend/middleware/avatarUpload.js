
const multer = require("multer");
const path = require("path");

/*
 * ==================================================
 * WELLJOB SOLUTIONS
 * PROFILE PICTURE UPLOAD MIDDLEWARE
 * ==================================================
 *
 * This middleware is separate from the existing
 * employee document and incident evidence upload
 * middleware.
 *
 * Security controls:
 *
 * - One image per request
 * - Maximum file size: 2 MB
 * - JPG, PNG, and WebP only
 * - File extension and MIME type validation
 * - File signature validation
 * - No client-controlled storage filename
 * - No file is written to disk before validation
 *
 * Only the authenticated user's own profile
 * picture may be updated.
 *
 * Authentication and account ownership are
 * enforced by the route and controller.
 */

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": {
    extensions: [".jpg", ".jpeg"],
  },

  "image/png": {
    extensions: [".png"],
  },

  "image/webp": {
    extensions: [".webp"],
  },
};

/*
 * ==================================================
 * VALIDATE DECLARED IMAGE TYPE
 * ==================================================
 */

function getImageType(file) {
  if (!file) {
    return null;
  }

  const mimetype = String(
    file.mimetype || ""
  )
    .trim()
    .toLowerCase();

  const configuration =
    ALLOWED_IMAGE_TYPES[mimetype];

  if (!configuration) {
    return null;
  }

  const extension = path
    .extname(
      String(file.originalname || "")
    )
    .toLowerCase();

  if (
    !configuration.extensions.includes(
      extension
    )
  ) {
    return null;
  }

  return mimetype;
}

/*
 * ==================================================
 * VALIDATE ACTUAL FILE SIGNATURE
 * ==================================================
 *
 * MIME types and filename extensions can be
 * manipulated by the uploading client.
 *
 * Check the uploaded bytes before accepting
 * the image.
 */

function hasValidImageSignature(
  buffer,
  mimetype
) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0
  ) {
    return false;
  }

  /*
   * JPEG:
   * FF D8 FF
   */

  if (mimetype === "image/jpeg") {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  /*
   * PNG:
   * 89 50 4E 47 0D 0A 1A 0A
   */

  if (mimetype === "image/png") {
    const pngSignature = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ]);

    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        pngSignature
      )
    );
  }

  /*
   * WebP:
   *
   * Bytes 0-3: RIFF
   * Bytes 8-11: WEBP
   *
   * A valid WebP image must also identify one
   * of the supported WebP image chunk types.
   */

  if (mimetype === "image/webp") {
    if (buffer.length < 20) {
      return false;
    }

    const riffHeader = buffer
      .subarray(0, 4)
      .toString("ascii");

    const webpHeader = buffer
      .subarray(8, 12)
      .toString("ascii");

    const imageChunk = buffer
      .subarray(12, 16)
      .toString("ascii");

    const supportedChunks = new Set([
      "VP8 ",
      "VP8L",
      "VP8X",
    ]);

    return (
      riffHeader === "RIFF" &&
      webpHeader === "WEBP" &&
      supportedChunks.has(imageChunk)
    );
  }

  return false;
}

/*
 * ==================================================
 * MULTER STORAGE
 * ==================================================
 *
 * The image is temporarily held in memory.
 *
 * The controller will generate a safe filename
 * and save the validated image to the dedicated
 * avatar storage directory.
 *
 * This prevents an invalid image from being
 * automatically written to the filesystem.
 */

const storage = multer.memoryStorage();

/*
 * ==================================================
 * MULTER FILE FILTER
 * ==================================================
 */

function avatarFileFilter(
  req,
  file,
  callback
) {
  const mimetype = getImageType(file);

  if (!mimetype) {
    const error = new Error(
      "Only JPG, PNG, and WebP profile pictures are allowed."
    );

    error.statusCode = 415;

    return callback(
      error,
      false
    );
  }

  return callback(
    null,
    true
  );
}

/*
 * ==================================================
 * UPLOAD CONFIGURATION
 * ==================================================
 *
 * The frontend must upload the image using
 * multipart/form-data and the field name:
 *
 * avatar
 */

const upload = multer({
  storage,

  fileFilter: avatarFileFilter,

  limits: {
    fileSize: MAX_AVATAR_SIZE,

    files: 1,

    fields: 0,

    parts: 1,

    fieldNameSize: 50,
  },
});

const parseAvatar = upload.single(
  "avatar"
);

/*
 * ==================================================
 * PROFILE PICTURE UPLOAD MIDDLEWARE
 * ==================================================
 */

function avatarUpload(
  req,
  res,
  next
) {
  parseAvatar(
    req,
    res,
    (error) => {
      /*
       * ==================================================
       * MULTER ERRORS
       * ==================================================
       */

      if (error) {
        if (
          error instanceof
          multer.MulterError
        ) {
          if (
            error.code ===
            "LIMIT_FILE_SIZE"
          ) {
            return res
              .status(413)
              .json({
                success: false,

                message:
                  "Profile picture must not exceed 2 MB.",
              });
          }

          if (
            error.code ===
            "LIMIT_UNEXPECTED_FILE"
          ) {
            return res
              .status(400)
              .json({
                success: false,

                message:
                  "Upload exactly one image using the avatar field.",
              });
          }

          return res
            .status(400)
            .json({
              success: false,

              message:
                "Invalid profile picture upload request.",
            });
        }

        /*
         * File type validation errors.
         */

        if (
          error.statusCode === 415
        ) {
          return res
            .status(415)
            .json({
              success: false,

              message:
                "Only JPG, PNG, and WebP profile pictures are allowed.",
            });
        }

        console.error(
          "PROFILE PICTURE UPLOAD ERROR:",
          error
        );

        return res
          .status(400)
          .json({
            success: false,

            message:
              "Unable to process the profile picture upload.",
          });
      }

      /*
       * ==================================================
       * REQUIRE ONE IMAGE
       * ==================================================
       */

      if (
        !req.file ||
        !Buffer.isBuffer(
          req.file.buffer
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Please select a profile picture to upload.",
          });
      }

      /*
       * ==================================================
       * VERIFY ACTUAL FILE CONTENT
       * ==================================================
       */

      const mimetype = getImageType(
        req.file
      );

      if (
        !mimetype ||
        !hasValidImageSignature(
          req.file.buffer,
          mimetype
        )
      ) {
        req.file = undefined;

        return res
          .status(415)
          .json({
            success: false,

            message:
              "The uploaded file does not match a supported image format.",
          });
      }

      /*
       * The uploaded image has passed the
       * declared file type, file size,
       * and file signature checks.
       *
       * The next controller will perform
       * image processing and secure storage.
       */

      return next();
    }
  );
}

module.exports = avatarUpload;