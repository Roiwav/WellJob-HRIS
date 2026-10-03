"use strict";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY ||= "test-secret-key";
process.env.SUPABASE_STORAGE_BUCKET ||= "test-bucket";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateClientUploadMetadata,
} = require("../services/directUploadSecurityService");

function metadata(
  name,
  type
) {
  return {
    name,
    type,
    size: 1024,
  };
}

test(
  "JPEG metadata accepts jpg, jpeg, jfif, and jpe extensions",
  () => {
    for (
      const extension of [
        ".jpg",
        ".jpeg",
        ".jfif",
        ".jpe",
      ]
    ) {
      const result =
        validateClientUploadMetadata(
          metadata(
            `proof${extension}`,
            "image/jpeg"
          )
        );

      assert.equal(
        result.mimeType,
        "image/jpeg"
      );
    }
  }
);

test(
  "JPEG MIME with PNG extension is rejected",
  () => {
    assert.throws(
      () =>
        validateClientUploadMetadata(
          metadata(
            "proof.png",
            "image/jpeg"
          )
        ),
      (error) => {
        assert.equal(
          error.code,
          "FILE_TYPE_MISMATCH"
        );

        assert.equal(
          error.statusCode,
          415
        );

        return true;
      }
    );
  }
);

test(
  "WEBP remains rejected because incident protected evidence supports PNG, JPEG, and PDF",
  () => {
    assert.throws(
      () =>
        validateClientUploadMetadata(
          metadata(
            "proof.webp",
            "image/webp"
          )
        ),
      (error) => {
        assert.equal(
          error.code,
          "UNSUPPORTED_FILE_TYPE"
        );

        assert.equal(
          error.statusCode,
          415
        );

        return true;
      }
    );
  }
);