const {
  createClient,
} = require("@supabase/supabase-js");

function getRequiredEnv(name) {
  const value = String(
    process.env[name] ?? ""
  ).trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
}

const SUPABASE_URL =
  getRequiredEnv(
    "SUPABASE_URL"
  );

const SUPABASE_SECRET_KEY =
  getRequiredEnv(
    "SUPABASE_SECRET_KEY"
  );

const SUPABASE_STORAGE_BUCKET =
  getRequiredEnv(
    "SUPABASE_STORAGE_BUCKET"
  );

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

module.exports = {
  supabase,
  SUPABASE_STORAGE_BUCKET,
};
